import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDocFromServer,
  addDoc,
  updateDoc,
  query,
  where,
  limit,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { INDIAN_CROP_DATASET } from '../data/indianCropsData';
import { CropRecord, QueryLogEntry, TrainingDataEntry } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on application boot as required by firebase-skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or starting up.');
    }
    return false;
  }
}

// Check and seed Indian crop production dataset in Firestore
export async function ensureCropDatasetSeeded(): Promise<void> {
  const path = 'crop_production_data';
  try {
    const existingSnap = await getDocs(query(collection(db, path), limit(1)));
    if (!existingSnap.empty) {
      return; // Already populated
    }

    // Populate in small batches to stay within free-tier limits and avoid timeout
    const batch = writeBatch(db);
    // Seed initial representative sample to keep firestore write operations low and instant
    const initialSeed = INDIAN_CROP_DATASET.slice(0, 40);
    for (const record of initialSeed) {
      const newDocRef = doc(collection(db, path));
      batch.set(newDocRef, {
        state_name: record.State_Name,
        season: record.Season,
        crop: record.Crop,
        production: record.Production,
        rank: record.rank,
      });
    }
    await batch.commit();
    console.log(`Seeded ${initialSeed.length} crop records to Firestore`);
  } catch (err) {
    console.warn('Could not auto-seed crop dataset to Firestore (falling back to static reference):', err);
  }
}

// Query matching crops by State and Season from Firestore (with fallback to curated dataset)
export async function getCropsByStateAndSeason(state: string, season: string): Promise<CropRecord[]> {
  const path = 'crop_production_data';
  try {
    const q = query(
      collection(db, path),
      where('state_name', '==', state),
      where('season', '==', season)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const records: CropRecord[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          State_Name: data.state_name || state,
          Season: data.season || season,
          Crop: data.crop || '',
          Production: Number(data.production) || 0,
          rank: Number(data.rank) || 99,
        };
      });
      records.sort((a, b) => a.rank - b.rank);
      return records;
    }
  } catch (error) {
    console.warn('Firestore crop query failed, using static dataset fallback:', error);
  }

  // Fallback to in-memory authentic dataset
  return INDIAN_CROP_DATASET.filter(
    r => r.State_Name.toLowerCase() === state.toLowerCase() && r.Season.toLowerCase() === season.toLowerCase()
  ).sort((a, b) => a.rank - b.rank);
}

// Log query to Firestore
export async function logQueryToFirestore(entry: Omit<QueryLogEntry, 'id'>): Promise<string | null> {
  const path = 'query_logs';
  try {
    const docRef = await addDoc(collection(db, path), {
      timestamp: entry.timestamp || new Date().toISOString(),
      feature: entry.feature,
      inputSummary: (entry.inputSummary || '').slice(0, 1900),
      resultSummary: (entry.resultSummary || '').slice(0, 8000),
      diseaseName: entry.diseaseName || '',
      state: entry.state || '',
      crop: entry.crop || '',
      isHealthy: entry.isHealthy ?? false,
      userRole: entry.userRole || '',
    });
    return docRef.id;
  } catch (error) {
    console.error('Failed to log query to Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch {
      // Continue gracefully so user experience is not blocked
    }
    return null;
  }
}

// Fetch recent query logs for Admin Dashboard
export async function fetchQueryLogs(): Promise<QueryLogEntry[]> {
  const path = 'query_logs';
  try {
    const snap = await getDocs(collection(db, path));
    const logs: QueryLogEntry[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        timestamp: data.timestamp || new Date().toISOString(),
        feature: data.feature || 'Unknown',
        inputSummary: data.inputSummary || '',
        resultSummary: data.resultSummary || '',
        diseaseName: data.diseaseName || undefined,
        state: data.state || undefined,
        crop: data.crop || undefined,
        isHealthy: data.isHealthy !== undefined ? Boolean(data.isHealthy) : undefined,
        userRole: data.userRole || undefined,
      };
    });

    // Sort descending by timestamp
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return logs;
  } catch (error) {
    console.error('Failed to fetch query logs from Firestore:', error);
    return [];
  }
}

// Client-side image compressor for training data:
// Resizes image to max 400px on the longest side, compresses as JPEG at moderate quality (~60%), and returns base64 data string.
export async function compressImageForTraining(imageSource: string | Blob): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const maxDim = 400;
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof imageSource === 'string' ? imageSource : '');
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Moderate quality JPEG (~60%) keeping size ~15KB - 35KB, well under Firestore 1MB limit
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve(compressedBase64);
      } catch (err) {
        console.warn('Canvas compression fallback:', err);
        resolve(typeof imageSource === 'string' ? imageSource : '');
      }
    };

    img.onerror = (err) => {
      console.warn('Image loading failed during compression:', err);
      resolve(typeof imageSource === 'string' ? imageSource : '');
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

// Create a new record in the "training_data" Firestore collection with compressed base64 image
export async function createTrainingDataRecord(
  entry: Omit<TrainingDataEntry, 'id'>
): Promise<string | null> {
  const path = 'training_data';
  try {
    const docRef = await addDoc(collection(db, path), {
      image_base64: entry.image_base64,
      gemini_diagnosis: entry.gemini_diagnosis,
      timestamp: entry.timestamp || new Date().toISOString(),
      verified: false,
      plant_name: entry.plant_name || '',
      confidence: entry.confidence || '',
    });
    return docRef.id;
  } catch (error) {
    console.error('Failed to create training_data record:', error);
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch {
      // Continue gracefully so user experience is not interrupted
    }
    return null;
  }
}

// Update an existing record in "training_data" (e.g. when user confirms or corrects diagnosis)
export async function updateTrainingDataRecord(
  docId: string,
  update: {
    verified: boolean;
    confirmed_label: string;
    details?: string;
  }
): Promise<boolean> {
  const path = 'training_data';
  try {
    const docRef = doc(db, path, docId);
    await updateDoc(docRef, {
      verified: update.verified,
      confirmed_label: update.confirmed_label,
      details: update.details || '',
      updated_at: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Failed to update training_data record:', error);
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {
      // Graceful fallback
    }
    return false;
  }
}

// Fetch training data records for Admin/ML review
export async function fetchTrainingDataRecords(): Promise<TrainingDataEntry[]> {
  const path = 'training_data';
  try {
    const snap = await getDocs(collection(db, path));
    const records: TrainingDataEntry[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        image_base64: data.image_base64 || data.image_storage_path || '',
        gemini_diagnosis: data.gemini_diagnosis || '',
        timestamp: data.timestamp || new Date().toISOString(),
        verified: Boolean(data.verified),
        confirmed_label: data.confirmed_label || undefined,
        details: data.details || undefined,
        plant_name: data.plant_name || undefined,
        confidence: data.confidence || undefined,
      };
    });
    records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return records;
  } catch (error) {
    console.warn('Failed to fetch training data records:', error);
    return [];
  }
}


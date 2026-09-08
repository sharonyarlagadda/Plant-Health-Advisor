export type AppSection = 'diagnosis' | 'checklist' | 'advisory' | 'dashboard';

export type UserRole = 'Farmer' | 'Home Gardener';

export type Season = 'Kharif' | 'Rabi' | 'Whole Year' | 'Summer' | 'Autumn' | 'Winter';

export interface CropRecord {
  id?: string;
  State_Name: string;
  Season: Season;
  Crop: string;
  Production: number; // in tonnes
  rank: number; // 1 = highest in state/season
}

export interface DiagnosisResult {
  plantName: string;
  isHealthy: boolean;
  status: 'Healthy' | 'Diseased';
  diseaseName: string;
  confidence: 'High' | 'Moderate' | 'Low';
  explanation: string;
  symptoms: string[];
  treatments: {
    naturalOrganic: string[];
    chemicalOrStandard: string[];
  };
  preventiveMeasures: string[];
  disclaimer: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  action: string;
  criticality: 'Low' | 'Medium' | 'High';
  checked?: boolean;
}

export interface ChecklistResult {
  plantName: string;
  overview: string;
  checklist: ChecklistItem[];
}

export interface AdvisoryResult {
  state: string;
  season: Season;
  crop: string;
  userRole: UserRole;
  verdict: 'Highly Recommended' | 'Recommended' | 'Moderate / Conditional' | 'Challenging';
  productionRankText: string;
  summary: string;
  detailedAdvice: string;
  keyActionTips: string[];
  topCropsInRegion: {
    crop: string;
    production: number;
    rank: number;
  }[];
  waterAndSoilNotes: string;
}

export interface QueryLogEntry {
  id?: string;
  timestamp: string; // ISO string
  feature: 'Photo Diagnosis' | 'Preventive Checklist' | 'Regional Advisory';
  inputSummary: string;
  resultSummary: string;
  diseaseName?: string;
  state?: string;
  crop?: string;
  isHealthy?: boolean;
  userRole?: UserRole;
}

export interface TrainingDataEntry {
  id?: string;
  image_base64: string;
  image_storage_path?: string;
  gemini_diagnosis: string;
  timestamp: string; // ISO string
  verified: boolean;
  confirmed_label?: string;
  details?: string;
  plant_name?: string;
  confidence?: string;
}


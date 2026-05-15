export enum ThreatLevel {
  THREAT = 'Threat',
  CAUTION = 'Caution',
  SAFE = 'Safe',
}

export enum CallStatus {
  ANSWERED = 'answered',
  MISSED = 'missed',
  BLOCKED = 'blocked',
}

export enum MessageStatus {
  VERIFIED = 'Verified',
  SUSPICIOUS = 'Suspicious',
  FRAUD = 'Fraud',
  TRANSACTION = 'Transaction',
  OTP = 'OTP',
  PROMOTION = 'Promotion',
}

export interface MessageRecord {
  id: string;
  sender: string;
  content: string;
  timestamp: any;
  status: MessageStatus;
  threatLevel: ThreatLevel;
  category: string;
  userId: string;
  summary: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallRecord {
  id: string;
  phoneNumber: string;
  callerName?: string;
  timestamp: string;
  status: CallStatus;
  duration: number;
  threatLevel: ThreatLevel;
  scamIndicators?: string;
  userId: string;
}

export interface FamilyMember {
  id: string;
  userId: string;
  memberName: string;
  memberPhoneNumber: string;
  alertOnCalls: boolean;
  alertOnMessages: boolean;
  alertOnRegistry: boolean;
  createdAt: string;
}

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
  }
}

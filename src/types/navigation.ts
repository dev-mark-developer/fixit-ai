import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Otp: { email: string; purpose: 'Registration' | 'ForgotPassword'; password?: string };
  ResetPassword: { email: string; otpCode: string };
};

// Root stack — rendered for all non-mentor authenticated users
export type RootStackParamList = {
  Home: undefined;
  Dating: NavigatorScreenParams<DatingStackParamList> | undefined;
  Penpal: NavigatorScreenParams<PenpalStackParamList> | undefined;
  MentorSetup: undefined;
  // Shared screens accessible from drawers and notification bell
  Notifications: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type MentorDrawerParamList = {
  MentorDashboard: undefined;
};

export type MentorStackParamList = {
  MentorProfileSetup: undefined;
  MentorSubscription: undefined;
  MentorEditProfile: undefined;
  MentorMain: NavigatorScreenParams<MentorDrawerParamList> | undefined;
  // Shared utility screens accessible from the mentor drawer
  Notifications: undefined;
  ChangePassword: undefined;
  EditProfile: undefined;
  Faqs: undefined;
  ContactUs: undefined;
};

export type PenpalPublicProfileParams = {
  userId: number;
  pseudoName: string;
  letterType: string;
  identityVisibility: string;
  city?: string;
  state?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
};

// ── Penpal drawer (main area) ───────────────────────────────────
export type PenpalDrawerParamList = {
  PenpalHome: undefined;
  PenpalDiscover: undefined;
  PenpalConnections: undefined;
  PenpalLetters: undefined;
};

export type PenpalStackParamList = {
  PenpalEntry: undefined;
  PenpalSetup: undefined;
  PenpalMain: NavigatorScreenParams<PenpalDrawerParamList> | undefined;
  PenpalLetterDetail: { letterId: number };
  PenpalCompose: { receiverId: number; receiverPseudoName: string };
  PenpalPublicProfile: PenpalPublicProfileParams;
};

// ── Dating drawer (main area) ───────────────────────────────────
export type DatingDrawerParamList = {
  DatingDiscover: undefined;
  DatingMatches: undefined;
  DatingChats: undefined;
  DatingBlockList: undefined;
};

export type DatingStackParamList = {
  DatingLobby: undefined;
  // Non-Spiritual
  NonSpiritualEntry: undefined;
  DatingInterestSelection: { datingType: 'NonSpiritual' | 'Spiritual' };
  DatingIceBreakerSelection: { datingType: 'NonSpiritual' | 'Spiritual'; editMode?: boolean };
  DatingMain: NavigatorScreenParams<DatingDrawerParamList> | undefined;
  DatingProfileDetail: {
    userId: number;
    firstName: string;
    lastName: string;
    age?: number;
    city?: string;
    country?: string;
    about?: string;
    displayImageUrl?: string;
    profileImageUrl?: string;
    interests: string[];
    images: string[];
    iceBreakerQuestions: string[];
  };
  DatingChatDetail: { matchId: number; matchedUserId: number; matchedUserName: string };
  DatingPremium: { datingType: 'NonSpiritual' | 'Spiritual' };
  // Spiritual
  SpiritualEntry: undefined;
  VettingQuiz: undefined;
  UploadCertificate: undefined;
  SpiritualMentors: undefined;
};

// Kept for shared screen components that still reference it
export type ProfileStackParamList = {
  ProfileMain: undefined;
  Notifications: undefined;
  ChangePassword: undefined;
  EditProfile: undefined;
  Faqs: undefined;
  ContactUs: undefined;
};

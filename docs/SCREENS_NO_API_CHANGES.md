# Screens — No API Changes Required

These screens are fully functional with the **existing API** as-is. Their UI
matches the Figma (or was intentionally left unchanged) and nothing on the
backend needs to change for them.

> Counterpart file: [SCREENS_API_CHANGES_REQUIRED.md](./SCREENS_API_CHANGES_REQUIRED.md)
> · Details of each gap live in [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md)

## App shell
| Screen | File |
|--------|------|
| Splash | `src/screens/SplashScreen.tsx` |
| Home ("What You Want To Do?") | `src/screens/main/HomeScreen.tsx` |

## Auth
| Screen | File |
|--------|------|
| Welcome ("New Places, Unforgettable Dating.") | `src/screens/auth/WelcomeScreen.tsx` |
| Login | `src/screens/auth/LoginScreen.tsx` |
| Sign Up | `src/screens/auth/RegisterScreen.tsx` |
| Forgot Password | `src/screens/auth/ForgotPasswordScreen.tsx` |
| OTP Verification | `src/screens/auth/OtpScreen.tsx` |
| Reset Password | `src/screens/auth/ResetPasswordScreen.tsx` |

## Main / shared
| Screen | File |
|--------|------|
| Profile & Settings | `src/screens/main/ProfileScreen.tsx` |
| Edit Profile | `src/screens/main/EditProfileScreen.tsx` |
| Notifications | `src/screens/main/NotificationsScreen.tsx` |
| Change Password | `src/screens/main/ChangePasswordScreen.tsx` |
| FAQs | `src/screens/main/FaqsScreen.tsx` |
| Contact Us | `src/screens/main/ContactUsScreen.tsx` |

## Dating
| Screen | File |
|--------|------|
| Dating Lobby ("Choose Your Path") | `src/screens/dating/DatingLobbyScreen.tsx` |
| Non-Spiritual Entry (profile setup) | `src/screens/dating/NonSpiritualEntryScreen.tsx` |
| Spiritual Entry (Purpose + Path to Alignment) | `src/screens/dating/SpiritualEntryScreen.tsx` |
| Interest Selection ("Discover Your Resonance") | `src/screens/dating/DatingInterestSelectionScreen.tsx` |
| Ice Breaker Selection ("Configure Ice Breaker") | `src/screens/dating/DatingIceBreakerSelectionScreen.tsx` |
| Upload Certificate | `src/screens/dating/UploadCertificateScreen.tsx` |
| External / Spiritual Mentors list | `src/screens/dating/SpiritualMentorsScreen.tsx` |
| Chats list ("My Chats") | `src/screens/dating/DatingChatsScreen.tsx` |
| Profile Detail (other user) | `src/screens/dating/DatingProfileDetailScreen.tsx` |
| Block List | `src/screens/dating/DatingBlockListScreen.tsx` |

## Penpal
| Screen | File |
|--------|------|
| Penpal Entry | `src/screens/penpal/PenpalEntryScreen.tsx` |
| Penpal Setup (preferences) | `src/screens/penpal/PenpalSetupScreen.tsx` |
| Penpal Home (commented out of nav, kept) | `src/screens/penpal/PenpalHomeScreen.tsx` |
| Letters (inbox/outbox) | `src/screens/penpal/PenpalLettersScreen.tsx` |
| Compose Letter | `src/screens/penpal/PenpalComposeScreen.tsx` |
| Letter Detail | `src/screens/penpal/PenpalLetterDetailScreen.tsx` |

## Mentor
| Screen | File |
|--------|------|
| Mentor Setup (root gate) | `src/screens/mentor/MentorSetupScreen.tsx` |
| Mentor Dashboard (My Seekers) | `src/screens/mentor/MentorDashboardScreen.tsx` |
| Mentor Edit Profile | `src/screens/mentor/MentorEditProfileScreen.tsx` |

<!-- Keep in sync with API_CHANGES_NEEDED.md — if a gap gets logged for one of
     these screens, move it to SCREENS_API_CHANGES_REQUIRED.md. -->

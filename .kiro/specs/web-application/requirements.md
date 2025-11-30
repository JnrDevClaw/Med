# Med Connect Web App - Requirements Document

## Introduction

Med Connect is a healthcare web application that connects patients with doctors through multiple interaction channels including Q&A forums, AI-powered assistance, and video/voice consultations. The system implements a staged development approach with specific features for each stage, focusing on secure data storage using IPFS and Firestore integration.

## Glossary

- **Med_Connect_System**: The complete healthcare web application platform
- **User_Authentication_Service**: Component handling user registration, login, and role management
- **IPFS_Storage_Layer**: Decentralized storage system for user data
- **Firestore_Database**: Primary database for storing CIDs, mappings, and application data
- **QA_Forum_System**: Stack Overflow-style question and answer platform
- **AI_Integration_Service**: Service for integrating Hugging Face AI models
- **Video_or Voice_Call_System**: Real-time communication system for doctor-patient consultations
- **Credential_Verification_System**: AI-powered system for verifying doctor credentials
- **Doctor_Discussion_Platform**: Private discussion area for verified doctors

## Requirements

### Requirement 1: User Authentication and Data Storage (Stage 1)

**User Story:** As a user (doctor or patient), I want to register with a username and have my data securely stored, so that I can access the platform with proper role-based permissions.

#### Acceptance Criteria

1. WHEN a user registers with a username, THE User_Authentication_Service SHALL store user data on IPFS and map the CID to the username in Firestore
2. THE User_Authentication_Service SHALL support only two user roles: Doctor and Patient
3. WHEN user data needs to be retrieved, THE Med_Connect_System SHALL use the username to fetch the CID from Firestore and retrieve data from IPFS
4. THE Med_Connect_System SHALL use only Firestore as the database, removing any other database implementations
5. THE User_Authentication_Service SHALL collect only username (not first and last names separately)

### Requirement 2: Q&A Dashboard System (Stage 2)

**User Story:** As a user, I want to participate in a Stack Overflow-style Q&A forum, so that I can ask health questions and get answers from the community and doctors.

#### Acceptance Criteria

1. THE QA_Forum_System SHALL allow users to post questions with categories
2. WHEN users interact with questions, THE QA_Forum_System SHALL support upvoting and downvoting functionality
3. THE QA_Forum_System SHALL allow commenting on questions and tagging other comments
4. WHEN displaying responses, THE QA_Forum_System SHALL visually highlight answers from doctors
5. WHEN fetching questions, THE QA_Forum_System SHALL filter by categories and rank by upvotes or show oldest first if no upvotes exist

### Requirement 3: AI-Powered Assistance (Stage 3)

**User Story:** As a user, I want to get AI-powered help with my health questions through refined prompts, so that I can receive more accurate and helpful responses.

#### Acceptance Criteria

1. THE AI_Integration_Service SHALL provide a "Refine Prompt" button beside the text input box
2. WHEN a user submits a prompt, THE AI_Integration_Service SHALL process it through Hugging Face inference models before sending to the main AI
3. THE AI_Integration_Service SHALL integrate the medgemma-4b-it model from Hugging Face
4. WHEN the prompt is refined, THE Med_Connect_System SHALL show the refined version to the user for approval or editing of the original
5. THE AI_Integration_Service SHALL prevent direct editing of refined prompts by users

### Requirement 4: Video/Voice Call System (Stage 4)

**User Story:** As a patient, I want to have video or voice calls with available doctors, so that I can get real-time medical consultation when other resources are insufficient.

#### Acceptance Criteria

1. THE Video_Call_System SHALL automatically find doctors who are currently online
2. WHEN a patient wants to connect, THE Video_Call_System SHALL send connection requests to available doctors
3. THE Video_Call_System SHALL require patients to specify their health issue category before starting a call
4. THE Med_Connect_System SHALL prompt users to try Q&A and AI sections first before requesting calls
5. THE Video_Call_System SHALL provide navigation links to Q&A and AI sections during the call request process

### Requirement 5: Doctor Credential Verification (Stage 5)

**User Story:** As a doctor, I want to upload and verify my medical credentials, so that I can access doctor-specific features and be identified as a verified medical practitioner.

#### Acceptance Criteria

1. THE Credential_Verification_System SHALL allow doctors to upload certificates and identification documents
2. WHEN credentials are uploaded, THE Credential_Verification_System SHALL process them through AI/APIs for verification
3. THE Credential_Verification_System SHALL update the doctor's isVerified status to true upon successful verification
4. THE Med_Connect_System SHALL implement route protection requiring isVerified equals true for doctor privileges
5. THE Credential_Verification_System SHALL provide verification results and feedback to doctors

### Requirement 6: Doctor-Only Discussion Platform (Stage 6)

**User Story:** As a verified doctor, I want to participate in private discussions with other doctors, so that I can share knowledge and discuss complex cases professionally.

#### Acceptance Criteria

1. THE Doctor_Discussion_Platform SHALL allow verified doctors to create discussion topics with categories
2. THE Doctor_Discussion_Platform SHALL support commenting and tagging within discussions
3. THE Doctor_Discussion_Platform SHALL restrict access to users with isVerified equals true
4. THE Doctor_Discussion_Platform SHALL organize discussions by topics and categories
5. THE Med_Connect_System SHALL implement proper route protection to ensure only verified doctors can access this platform
# Med Connect Web App - Development Guidelines

## Project Overview
Med Connect is a healthcare web application that connects patients with doctors through Q&A, AI assistance, and video consultations. The app follows a 6-stage development approach with specific implementation requirements.

## Technology Stack Requirements
- **Frontend**: Svelte/SvelteKit with Tailwind CSS
- **Backend**: Node.js with Express
- **Database**: Firestore (Firebase) - ONLY database to be used
- **Storage**: IPFS for user data storage
- **AI Integration**: Hugging Face models (specifically medgemma-4b-it)
- **Authentication**: Firebase Auth with role-based access

## Data Architecture Rules

### User Data Storage Pattern
- **Primary Storage**: Store all user data on IPFS
- **Mapping Layer**: Store IPFS CIDs mapped to usernames in Firestore
- **Data Retrieval**: Use username → CID → IPFS data flow
- **User Roles**: Only two roles - "Doctor" and "Patient"
- **Username Only**: Remove first/last name fields, use single username field

### Database Guidelines
- Use ONLY Firestore as the database
- Remove any existing database implementations (PostgreSQL, MySQL, etc.)
- Implement proper Firestore security rules
- Structure collections for optimal querying and performance

## Stage-Based Development Rules

### Stage 1: User Authentication & Signup
- Implement IPFS storage for user data
- Map CIDs to usernames in Firestore
- Support Doctor/Patient role differentiation
- Update existing structure to use username only
- Remove first/last name requirements

### Stage 2: Q&A Dashboard (Stack Overflow Style)
- Implement upvote/downvote functionality
- Add question categories
- Enable commenting and comment tagging
- Highlight doctor responses visually
- Implement filtering by categories
- Rank by upvotes or show oldest first if no upvotes

### Stage 3: AI Integration
- Add "Refine Prompt" button beside text input
- Integrate Hugging Face inference models
- Use medgemma-4b-it model initially
- Show refined prompt to user for approval/editing
- Prevent direct editing of refined prompts

### Stage 4: Video/Voice Calls
- Auto-discover online doctors
- Implement connection requests
- Require health issue category before calls
- Prompt users to try Q&A and AI first
- Provide navigation links to other sections

### Stage 5: Doctor Verification
- Upload credential verification system
- AI/API-based credential validation
- Set isVerified flag for verified doctors
- Implement route protection for doctor privileges

### Stage 6: Doctor-Only Discussions
- Private discussion area for verified doctors
- Topic-based discussions with categories
- Comment and tagging system
- Restrict access to isVerified === true doctors

## Implementation Guidelines

### Authentication & Authorization
- Implement role-based access control (Doctor/Patient)
- Use Firebase Auth for user management
- Protect routes based on user roles and verification status
- Maintain secure session management

### API Design Standards
- Follow RESTful principles
- Implement proper error handling
- Use consistent response formats
- Include appropriate HTTP status codes
- Validate all inputs thoroughly

### Frontend Development
- Use Svelte/SvelteKit framework
- Implement responsive design with Tailwind CSS
- Create reusable components
- Handle loading states and errors gracefully
- Optimize for mobile and desktop experiences

### Code Quality Requirements
- Follow consistent naming conventions
- Implement proper error handling
- Write clean, maintainable code
- Document complex business logic
- Use TypeScript where beneficial

## Security Requirements
- Validate all user inputs
- Implement proper authentication flows
- Secure API endpoints appropriately
- Follow healthcare data privacy standards
- Implement proper access controls for sensitive features
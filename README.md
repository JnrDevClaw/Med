# Medical Platform - Decentralized Healthcare Solution

A comprehensive full-stack medical platform built with modern web technologies and decentralized identity solutions.

## 🏗️ Architecture

- **Frontend**: Svelte 5 + Tailwind CSS
- **Backend**: Fastify + TypeScript
- **Identity**: Ceramic DID (Decentralized Identity)
- **Storage**: IPFS + Ceramic IDX
- **Video Calls**: Agora SDK
- **AI Models**: HuggingFace (BioGPT, Mistral-med)
- **Database**: PostgreSQL
- **Deployment**: Vercel (Frontend) + Railway (Backend)

## 📁 Project Structure

```
Med/
├── frontend/                 # Svelte 5 + Tailwind CSS
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── routes/         # Page routes
│   │   ├── lib/            # Utilities and stores
│   │   └── app.html        # Main HTML template
│   ├── static/             # Static assets
│   └── package.json
├── backend/                 # Fastify API server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── models/         # Database models
│   │   ├── middleware/     # Auth & validation
│   │   └── utils/          # Helper functions
│   └── package.json
├── docker-compose.yml       # Container orchestration
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Med
   ```

2. **Copy environment templates**
   ```bash
   # Frontend
   cp frontend/.env.example frontend/.env
   
   # Backend
   cp backend/.env.example backend/.env
   ```

3. **Configure environment variables**
   
   **Frontend (.env)**:
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_CERAMIC_API_URL=https://ceramic-clay.3boxlabs.com
   VITE_AGORA_APP_ID=your_agora_app_id
   ```
   
   **Backend (.env)**:
   ```env
   PORT=3001
   DATABASE_URL=postgresql://username:password@localhost:5432/medplatform
   JWT_SECRET=your-super-secret-jwt-key
   
   # Ceramic Configuration
   CERAMIC_API_URL=https://ceramic-clay.3boxlabs.com
   CERAMIC_SEED=your-ceramic-seed
   
   # Agora Configuration
   AGORA_APP_ID=your_agora_app_id
   AGORA_APP_CERTIFICATE=your_agora_app_certificate
   
   # HuggingFace Configuration
   HUGGINGFACE_API_KEY=your_huggingface_api_key
   
   # IPFS Configuration
   IPFS_API_URL=https://ipfs.infura.io:5001
   IPFS_API_KEY=your_ipfs_api_key
   IPFS_API_SECRET=your_ipfs_api_secret
   ```

### Development Setup

#### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Database: localhost:5432

#### Option 2: Manual Setup

1. **Start the backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Setup PostgreSQL database**
   ```bash
   # Using Docker
   docker run --name medplatform-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=medplatform -p 5432:5432 -d postgres:15
   
   # Run migrations
   cd backend
   npm run migrate
   ```

## 🔑 Features

### Authentication & Identity
- **Decentralized Identity**: Ceramic DID-based authentication
- **Self-Sovereign Identity**: Users control their own data
- **Role-based Access**: Patient and Doctor roles

### Doctor Verification
- **Credential Upload**: PDF/image certificate upload
- **IPFS Storage**: Decentralized document storage
- **Verifiable Credentials**: Ceramic-based credential issuance
- **Verification Status**: Visual verification badges

### AI Medical Consultation
- **Multiple AI Models**: Support for BioGPT, Mistral-med
- **Chat Interface**: Real-time conversation UI
- **Medical Disclaimers**: Appropriate warning messages
- **Consultation History**: Persistent chat records

### Video Consultations
- **Real-time Video/Audio**: Agora SDK integration
- **1:1 Consultations**: Patient-doctor video calls
- **Call Controls**: Mute, video toggle, screen share
- **Connection Management**: Robust connection handling

### Data Privacy & Security
- **Encrypted Storage**: Sensitive data encryption
- **Decentralized Records**: Health data on Ceramic + IPFS
- **GDPR Compliant**: User data control and deletion
- **Audit Trails**: Comprehensive logging

### Additional Features
- **Health Reminders**: Medication and appointment reminders
- **Notification System**: Real-time updates
- **Responsive Design**: Mobile-first approach
- **Progressive Web App**: PWA capabilities

## 🛠️ Development

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Lint code
npm run lint
```

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Run database migrations
npm run migrate

# Run tests
npm run test

# Lint code
npm run lint
```

### Database Management

#### Switching to MongoDB (Optional)

The default relational store is PostgreSQL (Knex). A lightweight MongoDB mode is available for rapid prototyping or when you prefer a document model.

1. Install and start MongoDB locally (default port 27017) or use a cloud URI.
2. In `backend/.env` set:
   ```env
   DB_CLIENT=mongo
   MONGO_URL=mongodb://localhost:27017
   MONGO_DB=medplatform
   ```
3. Remove/ignore `DATABASE_URL` (it will be unused in mongo mode).
4. Start the backend: `npm run dev`.

The Fastify instance exposes:
```ts
fastify.mongo.db            // native Db instance
fastify.mongo.getCollection // helper to grab a collection
fastify.db(collectionName)  // thin adapter for code paths expecting fastify.db
```

Limitations (current prototype):
- Knex migrations do NOT run in Mongo mode.
- Existing services that join across tables may need refactors to use aggregation pipelines.
- Some routes still expect SQL schema (e.g., joins in consultations/video). Use Postgres for full functionality until a dual abstraction layer is implemented.

Planned enhancements:
- Abstract repository layer (UserRepository, ConsultationRepository) with dual drivers.
- Automated Mongo index creation on startup.
- Data shape parity tests between Postgres and Mongo backends.

```bash
# Run migrations
npm run migrate

# Rollback migration
npm run migrate:rollback

# Reset database
npm run migrate:reset

# Seed database
npm run seed
```

## 🚢 Deployment

### Frontend (Vercel)

1. **Connect repository to Vercel**
2. **Configure build settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set environment variables** in Vercel dashboard

### Backend (Railway)

1. **Connect repository to Railway**
2. **Configure build settings**:
   - Build Command: `npm run build`
   - Start Command: `npm start`

3. **Add PostgreSQL service**
4. **Set environment variables** in Railway dashboard

### Docker Deployment

```bash
# Build images
docker-compose build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

## 🔐 Security Considerations

- All sensitive data is encrypted at rest
- DID-based authentication eliminates password risks
- IPFS ensures data immutability
- Regular security audits recommended
- Rate limiting on all API endpoints
- Input validation and sanitization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the [documentation](docs/)
- Contact the development team

## 🗺️ Roadmap

- [ ] Integration with more AI medical models
- [ ] Dual database abstraction (Postgres + Mongo parity layer)
- [ ] Mobile app development (React Native)
- [ ] Telemedicine appointment scheduling
- [ ] Integration with wearable devices
- [ ] Multi-language support
- [ ] Advanced analytics dashboard

# Yamix

**Open-source mental health community platform - メンタルヘルスコミュニティプラットフォーム**

A modern, self-hostable reimplementation of menhera.jp, designed to be the WordPress/Misskey for mental health support communities.

## 🌟 Features

- 📝 **Article & Blog Posts** - Share experiences and thoughts
- 💬 **Q&A System** - Ask questions and get support
- 🎭 **Anonymous Posting** - Post anonymously when needed
- 🏷️ **Tags & Categories** - Organize content effectively
- 🔐 **User Authentication** - Secure JWT-based auth
- 📱 **Responsive Design** - Works on all devices
- 🚀 **Modern Tech Stack** - Vue 3, Fastify, Prisma, PostgreSQL
- 📖 **MFM Support** - Misskey Flavored Markdown for rich text
- 🌐 **REST API** - Public API for integrations
- 🐳 **Docker Ready** - Easy deployment

## 🛠️ Tech Stack

### Frontend
- **Vue 3** with Composition API
- **Vite** for blazing fast builds
- **Pinia** for state management
- **UnoCSS** for styling (Tailwind-compatible)
- **MFM.js** for Misskey-compatible markdown
- **TypeScript** for type safety

### Backend
- **Fastify** - High-performance Node.js framework
- **Prisma** - Type-safe ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching layer
- **Zod** - Schema validation
- **OpenAPI** - Auto-generated API documentation

## 📦 Project Structure

```
yamix/
├── packages/
│   ├── frontend/       # Vue 3 application
│   ├── backend/        # Fastify API server
│   └── shared/         # Shared types and schemas
├── docker-compose.yml  # PostgreSQL + Redis
└── pnpm-workspace.yaml # Monorepo configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22.15.0 or higher
- pnpm 10.18.2 or higher
- Docker & Docker Compose

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yamisskey-dev/yamix.git
   cd yamix
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start database services**
   ```bash
   docker-compose up -d
   ```

4. **Setup backend environment**
   ```bash
   cd packages/backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run database migrations**
   ```bash
   cd packages/backend
   pnpm prisma:migrate
   pnpm db:seed
   ```

6. **Start development servers**
   ```bash
   # From project root
   pnpm dev
   ```

   This will start:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Docs: http://localhost:3000/docs

## 📚 Development

### Available Scripts

```bash
# Install all dependencies
pnpm install

# Start all services in development mode
pnpm dev

# Build all packages
pnpm build

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Clean all build artifacts
pnpm clean
```

### Backend Scripts

```bash
cd packages/backend

# Start dev server
pnpm dev

# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Open Prisma Studio
pnpm prisma:studio

# Seed database
pnpm db:seed
```

### Frontend Scripts

```bash
cd packages/frontend

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
DATABASE_URL="postgresql://yamix:password@localhost:5432/yamix"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
```

## 📖 API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:3000/docs
- **OpenAPI JSON**: http://localhost:3000/docs/json

### Example API Endpoints

```bash
# Register user
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "ユーザー名"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Get posts
GET /api/posts?page=1&limit=20

# Create post (requires auth)
POST /api/posts
Authorization: Bearer <token>
{
  "title": "タイトル",
  "content": "本文",
  "categoryId": 1,
  "tags": ["メンタルヘルス", "体験談"],
  "isAnonymous": false,
  "status": "published"
}
```

## 🎨 MFM (Misskey Flavored Markdown)

Yamix supports MFM for rich text formatting:

```
Plain text

**Bold text**
*Italic text*
~~Strikethrough~~

> Quote

`inline code`

​```
code block
​```

https://example.com (auto-linked)
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the AGPL-3.0 License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by the late menhera.jp
- Built with love for mental health communities
- MFM support powered by [mfm-js](https://github.com/misskey-dev/mfm-js)
- Similar spirit to [Misskey](https://github.com/misskey-dev/misskey)

## 📞 Support

For support and discussions:
- GitHub Issues: https://github.com/yamisskey-dev/yamix/issues
- Discussions: https://github.com/yamisskey-dev/yamix/discussions

---

**Made with ❤️ for those who need support**

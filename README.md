# LambdaLiga WebApp

A minimal web application with Supabase authentication, built with Next.js and TailwindCSS.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Supabase Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the contents of `supabase-setup.sql` to create the profiles table and set up RLS policies

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- TailwindCSS
- Supabase 
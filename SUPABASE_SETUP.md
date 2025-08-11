# Supabase Database Setup

Follow these steps to set up your Supabase database for the LambdaLiga WebApp:

## 1. Access Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Navigate to your project: `batmpsgprsfhvipsziyn`
3. Go to the **SQL Editor** in the left sidebar

## 2. Run the Database Setup Script

Copy and paste the entire contents of `supabase-setup.sql` into the SQL Editor and click **Run**.

This script will:
- Create the `profiles` table
- Enable Row Level Security (RLS)
- Set up RLS policies for secure access
- Create a database trigger to automatically create profiles for new users

## 3. Verify the Setup

After running the script, you should see:
- A new `profiles` table in your **Table Editor**
- RLS policies listed in the **Authentication > Policies** section
- A database function and trigger in the **Database > Functions** section

## 4. Test the Setup

1. Try creating a new user account in your app
2. Check the `profiles` table to see if a profile was automatically created
3. Verify that the user can access their profile data

## Troubleshooting

### RLS Policy Issues
If you encounter RLS policy errors:
1. Check that all policies were created successfully
2. Verify the `profiles` table has RLS enabled
3. Ensure the database trigger function has `SECURITY DEFINER`

### Profile Creation Issues
If profiles aren't being created automatically:
1. Check the database logs for trigger execution errors
2. Verify the trigger is attached to the `auth.users` table
3. Test the trigger function manually if needed

## Database Schema

The `profiles` table structure:
```sql
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

## Security Features

- **Row Level Security (RLS)**: Users can only access their own profile data
- **Automatic Profile Creation**: New users get profiles created automatically via database trigger
- **Secure Policies**: All database operations are controlled by RLS policies 
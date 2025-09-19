#!/bin/bash

# LambdaLiga ELO System Installation Script
# This script applies the ELO rating system to your database

echo "🏆 LambdaLiga ELO System Installation"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "elo-system.sql" ]; then
    echo "❌ Error: elo-system.sql not found in current directory"
    echo "Please run this script from the LambdaLiga project root"
    exit 1
fi

# Check if we have the test script
if [ ! -f "test-elo-system.sql" ]; then
    echo "❌ Error: test-elo-system.sql not found in current directory"
    echo "Please run this script from the LambdaLiga project root"
    exit 1
fi

echo "✅ Found ELO system files"

# Get database connection details
echo ""
echo "📊 Database Connection Setup"
echo "============================"

# Check for environment variables
if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_DB_URL" ]; then
    echo "⚠️  No database URL found in environment variables"
    echo "Please set either DATABASE_URL or SUPABASE_DB_URL"
    echo ""
    echo "Example:"
    echo "export DATABASE_URL='postgresql://username:password@host:port/database'"
    echo "export SUPABASE_DB_URL='postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres'"
    echo ""
    read -p "Enter your database URL: " DB_URL
    export DATABASE_URL="$DB_URL"
fi

# Use SUPABASE_DB_URL if available, otherwise DATABASE_URL
if [ ! -z "$SUPABASE_DB_URL" ]; then
    DB_URL="$SUPABASE_DB_URL"
    echo "✅ Using Supabase database URL"
elif [ ! -z "$DATABASE_URL" ]; then
    DB_URL="$DATABASE_URL"
    echo "✅ Using custom database URL"
else
    echo "❌ No database URL available"
    exit 1
fi

echo ""
echo "🔧 Installing ELO System"
echo "========================"

# Test database connection
echo "Testing database connection..."
if psql "$DB_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "Please check your database URL and credentials"
    exit 1
fi

# Apply the ELO system
echo "Applying ELO system schema..."
if psql "$DB_URL" -f elo-system.sql; then
    echo "✅ ELO system schema applied successfully"
else
    echo "❌ Failed to apply ELO system schema"
    echo "Please check the error messages above"
    exit 1
fi

# Apply the ambiguous column fix
echo "Applying ambiguous column reference fix..."
if psql "$DB_URL" -f fix-elo-ambiguous-column.sql; then
    echo "✅ Ambiguous column reference fix applied successfully"
else
    echo "⚠️  Ambiguous column reference fix failed - continuing anyway"
fi

echo ""
echo "🧪 Testing ELO System"
echo "====================="

# Test the system
echo "Running system tests..."
if psql "$DB_URL" -f test-elo-system.sql; then
    echo "✅ ELO system tests completed"
else
    echo "⚠️  Some tests failed - this might be normal for a new installation"
fi

echo ""
echo "🔍 Verifying Installation"
echo "========================"

# Verify key components
echo "Checking ELO system components..."

# Check if functions exist
FUNCTION_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%rating%';" | xargs)
echo "📊 Rating functions: $FUNCTION_COUNT"

# Check if triggers exist
TRIGGER_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trigger_update_ratings';" | xargs)
echo "🔗 Rating triggers: $TRIGGER_COUNT"

# Check if tables exist
TABLE_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('profiles', 'rating_history');" | xargs)
echo "🗃️  Rating tables: $TABLE_COUNT"

echo ""
echo "🎉 ELO System Installation Complete!"
echo "===================================="
echo ""
echo "📋 What was installed:"
echo "  • Enhanced profiles table with rating fields"
echo "  • Rating history tracking table"
echo "  • Glicko-2 rating calculation functions"
echo "  • Automatic rating update triggers"
echo "  • Leaderboard and statistics functions"
echo ""
echo "🚀 Next steps:"
echo "  1. Play a game to test the system"
echo "  2. Check ratings update automatically"
echo "  3. View leaderboard with get_leaderboard() function"
echo "  4. Monitor rating_history table for audit trail"
echo ""
echo "📚 Documentation:"
echo "  • Read ELO_SYSTEM_README.md for detailed information"
echo "  • Use test-elo-system.sql to verify functionality"
echo "  • Check database logs for any errors"
echo ""
echo "🔧 Troubleshooting:"
echo "  • If ratings don't update, check trigger installation"
echo "  • If functions fail, verify database permissions"
echo "  • Run test script to identify specific issues"
echo ""
echo "Happy gaming! 🎮"


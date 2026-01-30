#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎬 Pessimistic Locking Demo - Ticket Booking System${NC}"
echo -e "${BLUE}=================================================${NC}\n"

echo -e "${YELLOW}Step 1: Resetting database and seeding data...${NC}"
npm run db:reset

if [ $? -ne 0 ]; then
    echo -e "\n❌ Database reset failed. Please check your DATABASE_URL in .env"
    exit 1
fi

echo -e "\n${GREEN}✅ Database ready${NC}\n"

echo -e "${YELLOW}Step 2: Running concurrency tests...${NC}"
echo -e "${BLUE}This will simulate multiple users trying to book the same seats${NC}\n"

npm run test:e2e -- bookings-concurrency.e2e-spec.ts

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
    echo -e "${GREEN}🎉 Pessimistic locking is working correctly - no double bookings!${NC}\n"
else
    echo -e "\n❌ Tests failed. Check the output above for details.${NC}\n"
    exit 1
fi

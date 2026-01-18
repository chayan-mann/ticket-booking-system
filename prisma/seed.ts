import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { Pool } from "pg";

config(); 

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // Clean existing data in order (respecting foreign keys)
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.showSeat.deleteMany();
  await prisma.show.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.screen.deleteMany();
  await prisma.theatre.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Cleaned existing data");

  // Create Users
  const user1 = await prisma.user.create({
    data: {
      email: "john@example.com",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "jane@example.com",
    },
  });

  console.log("✅ Created users");

  // Create Movies
  const movie1 = await prisma.movie.create({
    data: {
      title: "Inception",
      durationMin: 148,
    },
  });

  const movie2 = await prisma.movie.create({
    data: {
      title: "The Dark Knight",
      durationMin: 152,
    },
  });

  const movie3 = await prisma.movie.create({
    data: {
      title: "Interstellar",
      durationMin: 169,
    },
  });

  console.log("✅ Created movies");

  // Create Theatres
  const theatre1 = await prisma.theatre.create({
    data: {
      name: "PVR Cinemas",
      city: "Mumbai",
    },
  });

  const theatre2 = await prisma.theatre.create({
    data: {
      name: "INOX Megaplex",
      city: "Delhi",
    },
  });

  console.log("✅ Created theatres");

  // Create Screens
  const screen1 = await prisma.screen.create({
    data: {
      name: "Screen 1",
      theatreId: theatre1.id,
      capacity: 100,
    },
  });

  const screen2 = await prisma.screen.create({
    data: {
      name: "Screen 2",
      theatreId: theatre1.id,
      capacity: 80,
    },
  });

  const screen3 = await prisma.screen.create({
    data: {
      name: "Audi 1",
      theatreId: theatre2.id,
      capacity: 120,
    },
  });

  console.log("✅ Created screens");

  // Create Seats for Screen 1 (10 rows, 10 seats each = 100 seats)
  const screen1Seats: Array<{ screenId: string; row: string; number: number }> =
    [];
  for (const row of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]) {
    for (let num = 1; num <= 10; num++) {
      screen1Seats.push({
        screenId: screen1.id,
        row,
        number: num,
      });
    }
  }
  await prisma.seat.createMany({ data: screen1Seats });

  // Create Seats for Screen 2 (8 rows, 10 seats each = 80 seats)
  const screen2Seats: Array<{ screenId: string; row: string; number: number }> =
    [];
  for (const row of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    for (let num = 1; num <= 10; num++) {
      screen2Seats.push({
        screenId: screen2.id,
        row,
        number: num,
      });
    }
  }
  await prisma.seat.createMany({ data: screen2Seats });

  // Create Seats for Screen 3 (12 rows, 10 seats each = 120 seats)
  const screen3Seats: Array<{ screenId: string; row: string; number: number }> =
    [];
  for (const row of [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
  ]) {
    for (let num = 1; num <= 10; num++) {
      screen3Seats.push({
        screenId: screen3.id,
        row,
        number: num,
      });
    }
  }
  await prisma.seat.createMany({ data: screen3Seats });

  console.log("✅ Created seats (300 total)");

  // Create Shows (future dates for booking)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0); // 2 PM

  const show1 = await prisma.show.create({
    data: {
      movieId: movie1.id,
      screenId: screen1.id,
      startTime: tomorrow,
    },
  });

  const evening = new Date(tomorrow);
  evening.setHours(18, 0, 0, 0); // 6 PM

  const show2 = await prisma.show.create({
    data: {
      movieId: movie2.id,
      screenId: screen1.id,
      startTime: evening,
    },
  });

  const show3 = await prisma.show.create({
    data: {
      movieId: movie3.id,
      screenId: screen2.id,
      startTime: tomorrow,
    },
  });

  const show4 = await prisma.show.create({
    data: {
      movieId: movie1.id,
      screenId: screen3.id,
      startTime: tomorrow,
    },
  });

  console.log("✅ Created shows");

  // Create ShowSeats for each show (all seats initially available)
  const allSeats = await prisma.seat.findMany();

  for (const show of [show1, show2, show3, show4]) {
    const showSeatsData = allSeats
      .filter(
        (seat) =>
          (show.id === show1.id && seat.screenId === screen1.id) ||
          (show.id === show2.id && seat.screenId === screen1.id) ||
          (show.id === show3.id && seat.screenId === screen2.id) ||
          (show.id === show4.id && seat.screenId === screen3.id),
      )
      .map((seat) => ({
        showId: show.id,
        seatId: seat.id,
      }));

    await prisma.showSeat.createMany({ data: showSeatsData });
  }

  console.log("✅ Created show seats");

  console.log("\n📊 Seed Summary:");
  console.log(`   Users: 2`);
  console.log(`   Movies: 3`);
  console.log(`   Theatres: 2`);
  console.log(`   Screens: 3`);
  console.log(`   Seats: 300`);
  console.log(`   Shows: 4`);
  console.log(`   Show Seats: Available for all shows`);
  console.log("\n🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

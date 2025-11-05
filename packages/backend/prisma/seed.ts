import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'column' },
      update: {},
      create: {
        name: 'コラム',
        slug: 'column',
        description: '体験や考察を綴ったコラム記事',
        order: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'experience' },
      update: {},
      create: {
        name: '体験談',
        slug: 'experience',
        description: '実際の体験を共有する記事',
        order: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'other' },
      update: {},
      create: {
        name: 'その他',
        slug: 'other',
        description: 'その他の投稿',
        order: 3,
      },
    }),
  ])

  console.log(`✅ Created ${categories.length} categories`)

  // Create some initial tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { slug: 'mental-health' },
      update: {},
      create: { name: 'メンタルヘルス', slug: 'mental-health' },
    }),
    prisma.tag.upsert({
      where: { slug: 'suicide' },
      update: {},
      create: { name: '希死念慮', slug: 'suicide' },
    }),
    prisma.tag.upsert({
      where: { slug: 'development-disorder' },
      update: {},
      create: { name: '発達障害', slug: 'development-disorder' },
    }),
    prisma.tag.upsert({
      where: { slug: 'depression' },
      update: {},
      create: { name: 'うつ病', slug: 'depression' },
    }),
    prisma.tag.upsert({
      where: { slug: 'anxiety' },
      update: {},
      create: { name: '不安障害', slug: 'anxiety' },
    }),
  ])

  console.log(`✅ Created ${tags.length} tags`)

  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

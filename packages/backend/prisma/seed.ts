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

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', // password123
      displayName: 'テストユーザー',
      bio: 'テスト用のアカウントです。',
    },
  })

  console.log(`✅ Created test user`)

  // Create test posts with lorem ipsum
  const posts = [
    {
      title: 'Lorem ipsum dolor sit amet',
      content: `# Lorem ipsum dolor sit amet

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Duis aute irure dolor

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

- Lorem ipsum dolor sit amet
- Consectetur adipiscing elit
- Sed do eiusmod tempor incididunt

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`,
      categoryId: categories[0].id,
      tags: ['mental-health', 'depression'],
      isAnonymous: false,
    },
  ]

  for (const postData of posts) {
    const post = await prisma.post.create({
      data: {
        title: postData.title,
        content: postData.content,
        categoryId: postData.categoryId,
        authorId: postData.isAnonymous ? null : testUser.id,
        isAnonymous: postData.isAnonymous,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    // Add tags to post
    for (const tagSlug of postData.tags) {
      const tag = tags.find((t) => t.slug === tagSlug)
      if (tag) {
        await prisma.postTag.create({
          data: {
            postId: post.id,
            tagId: tag.id,
          },
        })
      }
    }
  }

  console.log(`✅ Created ${posts.length} test posts`)

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

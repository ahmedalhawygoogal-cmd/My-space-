import type { QuoteCharacter } from '../types'

export const DEFAULT_QUOTES: QuoteCharacter[] = [
  {
    id: 'dq-steve-jobs',
    name: { en: 'Steve Jobs', ar: 'ستيف جوبز' },
    story: {
      en: 'American entrepreneur and co-founder of Apple, known for redefining personal computers, music, and smartphones through products like the Mac, iPod, and iPhone.',
      ar: 'رائد أعمال أمريكي ومؤسس مشارك لشركة آبل، اشتهر بإعادة تعريف الحواسيب الشخصية والموسيقى والهواتف الذكية من خلال منتجات مثل ماك وآي بود وآي فون.',
    },
    challenge: {
      en: 'He was fired from the company he founded, then returned to lead one of the greatest comebacks in tech history.',
      ar: 'طُرد من الشركة التي أسسها بنفسه، ثم عاد بها لتقود واحدة من أكبر نهضات التقنية في التاريخ.',
    },
    quote: {
      en: 'Stay hungry, stay foolish.',
      ar: 'ابقَ جائعاً، ابقَ أحمقاً.',
    },
  },
  {
    id: 'dq-thomas-edison',
    name: { en: 'Thomas Edison', ar: 'توماس إديسون' },
    story: {
      en: 'American inventor who created the practical electric light bulb and sound recorder, and held more than a thousand patents in his lifetime.',
      ar: 'مخترع أمريكي اخترع المصباح الكهربائي العملي ومُسجّل الصوت، وحصل على أكثر من ألف براءة اختراع خلال حياته.',
    },
    challenge: {
      en: 'He failed thousands of times before inventing the electric light bulb, but saw each attempt as learning, not failure.',
      ar: 'فشل آلاف المرات قبل أن ينجح في اختراع المصباح الكهربائي، لكنه رآها محاولات للتعلم وليس فشلاً.',
    },
    quote: {
      en: "I have not failed. I've just found 10,000 ways that won't work.",
      ar: 'لم أفشل. لقد وجدت 10,000 طريقة لا تعمل.',
    },
  },
  {
    id: 'dq-nelson-mandela',
    name: { en: 'Nelson Mandela', ar: 'نيلسون مانديلا' },
    story: {
      en: 'Anti-apartheid leader in South Africa who spent 27 years in prison before becoming the country’s first Black president and a symbol of reconciliation.',
      ar: 'مكافح ضد نظام التمييز العنصري في جنوب أفريقيا، قضى 27 عاماً في السجن قبل أن يصبح أول رئيس أسود للبلاد ورمزاً للمصالحة.',
    },
    challenge: {
      en: 'He spent decades in prison away from his family, then emerged as a leader seeking unity instead of revenge.',
      ar: 'أمضى عقوداً في السجن بعيدًا عن عائلته، وخرج قائدًا يسعى إلى الوحدة بدلاً من الانتقام.',
    },
    quote: {
      en: "It always seems impossible until it's done.",
      ar: 'يبدو الأمر مستحيلاً دائماً حتى يتحقق.',
    },
  },
  {
    id: 'dq-ibn-sina',
    name: { en: 'Ibn Sina', ar: 'ابن سينا' },
    story: {
      en: 'Persian physician and philosopher of the Islamic Golden Age, author of The Canon of Medicine, which was taught in European universities for centuries.',
      ar: 'طبيب وفيلسوف فارسي من العصر الذهبي للإسلام، ألف كتاب "القانون في الطب" الذي درّس في الجامعات الأوروبية قروناً.',
    },
    challenge: {
      en: 'He insisted on uniting philosophy with logic and medicine with experiment, writing encyclopedias that lit the path for modern science.',
      ar: 'أبى إلا أن يوحد الفلسفة بالمنطق والطب بالتجربة، فكتب الموسوعات التي أنارت الطريق للعلوم الحديثة.',
    },
    quote: {
      en: 'The knowledge of anything, since all things have causes, is not acquired or complete unless it is known by its causes.',
      ar: 'معرفة أي شيء، ما دامت لكل الأشياء أسباب، لا تكتمل إلا بمعرفة تلك الأسباب.',
    },
  },
  {
    id: 'dq-mohamed-salah',
    name: { en: 'Mohamed Salah', ar: 'محمد صلاح' },
    story: {
      en: 'Egyptian footballer, one of the finest forwards of his generation, who won major honors with Liverpool and the Egypt national team.',
      ar: 'لاعب كرة قدم مصري، أحد أفضل مهاجمي جيله، وتوّج مع نادي ليفربول ومنتخب مصر بإنجازات كبرى.',
    },
    challenge: {
      en: 'He started in the youth ranks of El Mokawloon and defied doubts about his ability to earn a place among the world’s stars.',
      ar: 'بدأ من ناشئي نادي المقاولون العرب وتحدى الشكوك في إمكاناته ليحجز مكانه بين نجوم العالم.',
    },
    quote: {
      en: 'I always believe in myself and work hard.',
      ar: 'أؤمن بنفسي دائماً وأعمل بجد.',
    },
  },
  {
    id: 'dq-elon-musk',
    name: { en: 'Elon Musk', ar: 'إيلون ماسك' },
    story: {
      en: 'South African entrepreneur who founded SpaceX and Tesla to make humanity multiplanetary and speed the shift to sustainable energy.',
      ar: 'رائد أعمال من جنوب أفريقيا، أسس سبيس إكس وتسلا بهدف جعل البشرية كواكبية وتسريع الانتقال للطاقة المستدامة.',
    },
    challenge: {
      en: 'He faced repeated near-bankruptcy with both companies in their early days, and insisted on continuing until he achieved goals that once seemed impossible.',
      ar: 'واجه الإفلاس المتكرر مع شركتيه في بدايتهما، وأصر على الاستمرار حتى حقق أهدافًا بدت مستحيلة.',
    },
    quote: {
      en: 'When something is important enough, you do it even if the odds are not in your favor.',
      ar: 'عندما يكون أمر ما مهماً بما يكفي، فإنك تفعله حتى لو لم تكن الاحتمالات في صالحك.',
    },
  },
]

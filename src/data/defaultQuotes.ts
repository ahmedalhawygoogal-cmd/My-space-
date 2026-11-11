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
    imageUrl: '/images/steve_jobs.webp',
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
    imageUrl: '/images/thomas_edison.webp',
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
    imageUrl: '/images/nelson_mandela.webp',
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
    imageUrl: '/images/ibn_sina.webp',
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
    imageUrl: '/images/mohamed_salah.webp',
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
    imageUrl: '/images/elon_musk.webp',
  },
  {
    id: 'dq-albert-einstein',
    name: { en: 'Albert Einstein', ar: 'ألبرت أينشتاين' },
    story: {
      en: 'German-born physicist who developed the theory of relativity and reshaped how we understand space, time, energy, and the universe.',
      ar: 'فيزيائي ألماني المولد وضع نظرية النسبية وأعاد تشكيل فهمنا للمكان والزمان والطاقة والكون.',
    },
    challenge: {
      en: 'He struggled in rigid classrooms as a child, later fled persecution, and rebuilt his life while changing the course of modern physics.',
      ar: 'عانى في الفصول الدراسية الجامدة طفلاً، ثم فرّ من الاضطهاد وأعاد بناء حياته وهو يغيّر مسار الفيزياء الحديثة.',
    },
    quote: {
      en: 'Imagination is more important than knowledge.',
      ar: 'الخيال أهم من المعرفة.',
    },
    imageUrl: '/images/einstein.webp',
  },
  {
    id: 'dq-marie-curie',
    name: { en: 'Marie Curie', ar: 'ماري كوري' },
    story: {
      en: 'Polish-French physicist and chemist, the first person to win Nobel Prizes in two sciences, and a pioneer of radioactivity research.',
      ar: 'فيزيائية وكيميائية بولندية فرنسية، أول من فاز بجائزتي نوبل في علمين مختلفين، ورائدة في بحوث النشاط الإشعاعي.',
    },
    challenge: {
      en: 'She studied in poverty in Paris, lost her husband Pierre, and kept working despite barriers that shut women out of science.',
      ar: 'درست في فقر بباريس، وفقدت زوجها بيير، وواصلت العمل رغم الحواجز التي أقصت النساء عن العلم.',
    },
    quote: {
      en: 'Nothing in life is to be feared, it is only to be understood.',
      ar: 'لا شيء في الحياة يُخاف منه، إنما يُفهم فقط.',
    },
    imageUrl: '/images/marie_curie.webp',
  },
  {
    id: 'dq-khalid-ibn-al-walid',
    name: { en: 'Khalid ibn al-Walid', ar: 'خالد بن الوليد' },
    story: {
      en: 'Companion of the Prophet and undefeated commander, known as the Sword of Allah, whose campaigns reshaped the early Islamic world.',
      ar: 'صحابي وقائد لم يُهزم، عُرف بسيف الله المسلول، وأعادت حملاته تشكيل العالم الإسلامي المبكر.',
    },
    challenge: {
      en: 'He never lost a battle even when outnumbered, then accepted being removed from command with discipline and loyalty.',
      ar: 'لم يُهزم في معركة حتى وهو أقل عدداً، ثم قبل العزل عن القيادة بانضباط وولاء.',
    },
    quote: {
      en: 'If you are truthful, you will not care who stands with you or against you.',
      ar: 'إن كنت صادقاً فلن يهمك من معك ومن عليك.',
    },
    imageUrl: '/images/khalid_ibn_al_walid.webp',
  },
  {
    id: 'dq-al-khwarizmi',
    name: { en: 'Al-Khwarizmi', ar: 'الخوارزمي' },
    story: {
      en: 'Persian mathematician of the Islamic Golden Age, father of algebra; the word algorithm comes from his name.',
      ar: 'عالم رياضيات فارسي من العصر الذهبي للإسلام، أبو علم الجبر؛ وكلمة خوارزمية مشتقة من اسمه.',
    },
    challenge: {
      en: 'He built a new language of mathematics from scattered knowledge, laying foundations used in every computer today.',
      ar: 'بنى لغة جديدة للرياضيات من معارف متفرقة، ووضع أسساً يستخدمها كل حاسوب اليوم.',
    },
    quote: {
      en: 'That which is required is that we find the unknown.',
      ar: 'المطلوب هو أن نجد المجهول.',
    },
    imageUrl: '/images/al_khwarizmi.webp',
  },
]

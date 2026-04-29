export type Locale = "en" | "zh-CN"

export interface Dictionary {
  common: {
    loading: string
    cancel: string
    delete: string
    save: string
    create: string
    confirm: string
  }
  header: {
    home: string
    kanban: string
    selectProject: string
    noProjectsYet: string
    newProject: string
    signOut: string
    deleteBoard: string
  }
  createDialog: {
    title: string
    description: string
    projectName: string
    placeholder: string
    cancel: string
    creating: string
    create: string
  }
  deleteDialog: {
    title: string
    description: (boardName: string) => string
    cancel: string
    deleting: string
    delete: string
  }
  kanban: {
    configError: string
    configErrorDetail: string
    configErrorHint: string
    noColumnsYet: string
    initializeBoard: string
  }
  column: {
    noTasks: string
    addTask: string
  }
  taskDialog: {
    editTask: string
    createNewTask: string
    title: string
    titlePlaceholder: string
    description: string
    descriptionPlaceholder: string
    column: string
    delete: string
    cancel: string
    saveChanges: string
    createTask: string
  }
  userButton: {
    settings: string
    profile: string
    signOut: string
    language: string
  }
  landing: {
    logIn: string
    getStarted: string
    badge: string
    heroTitle1: string
    heroTitle2: string
    heroDescription: string
    startForFree: string
    viewDemo: string
    noCreditCard: string
    featuresTitle: string
    featuresSubtitle: string
    featureVisualTitle: string
    featureVisualDesc: string
    featureCollabTitle: string
    featureCollabDesc: string
    featureRealtimeTitle: string
    featureRealtimeDesc: string
    featureSecureTitle: string
    featureSecureDesc: string
    featureTrackingTitle: string
    featureTrackingDesc: string
    featureAITitle: string
    featureAIDesc: string
    howItWorksTitle: string
    howItWorksSubtitle: string
    step1Title: string
    step1Desc: string
    step2Title: string
    step2Desc: string
    step3Title: string
    step3Desc: string
    testimonialsTitle: string
    testimonialsSubtitle: string
    ctaTitle: string
    ctaDescription: string
    ctaButton: string
    footerAbout: string
    footerFeatures: string
    footerPricing: string
    footerContact: string
    footerCopyright: string
  }
  profile: {
    title: string
    backToBoard: string
  }
  newBoard: {
    title: string
    description: string
    projectName: string
    placeholder: string
    creating: string
    createBoard: string
  }
  login: {
    welcomeBack: string
    signInDescription: string
    email: string
    emailPlaceholder: string
    password: string
    signIn: string
    signingIn: string
    noAccount: string
    signUp: string
    orContinueWith: string
    continueWithGoogle: string
    continueWithGithub: string
    createAccount: string
    createAccountDescription: string
    fullName: string
    fullNamePlaceholder: string
    confirmPassword: string
    creatingAccount: string
    haveAccount: string
    passwordMismatch: string
    forgotPassword: string
    resetPassword: string
    sendResetLink: string
    sending: string
    resetSent: string
    backToSignIn: string
  }
  columnNames: {
    backlog: string
    todo: string
    inProgress: string
    done: string
  }
}

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    common: {
      loading: "Loading...",
      cancel: "Cancel",
      delete: "Delete",
      save: "Save",
      create: "Create",
      confirm: "Confirm",
    },
    header: {
      home: "Home",
      kanban: "Kanban",
      selectProject: "Select Project",
      noProjectsYet: "No projects yet",
      newProject: "New Project",
      signOut: "Sign Out",
      deleteBoard: "Delete board",
    },
    createDialog: {
      title: "Create New Project",
      description: "Create a new Kanban board to manage your tasks.",
      projectName: "Project Name",
      placeholder: "e.g. Website Redesign",
      cancel: "Cancel",
      creating: "Creating...",
      create: "Create Project",
    },
    deleteDialog: {
      title: "Delete Board",
      description: (name) =>
        `Are you sure you want to delete "${name}"? This will permanently remove all columns and tasks. This action cannot be undone.`,
      cancel: "Cancel",
      deleting: "Deleting...",
      delete: "Delete Board",
    },
    kanban: {
      configError: "Configuration Error",
      configErrorDetail: "Please configure Supabase environment variables",
      configErrorHint:
        "Please make sure you have set up your Supabase project and configured the environment variables.",
      noColumnsYet: "No columns yet",
      initializeBoard: "Initialize Board",
    },
    column: {
      noTasks: "No tasks",
      addTask: "Add task",
    },
    taskDialog: {
      editTask: "Edit Task",
      createNewTask: "Create New Task",
      title: "Title",
      titlePlaceholder: "Enter task title",
      description: "Description",
      descriptionPlaceholder: "Enter task description (optional)",
      column: "Column",
      delete: "Delete",
      cancel: "Cancel",
      saveChanges: "Save Changes",
      createTask: "Create Task",
    },
    userButton: {
      settings: "Settings",
      profile: "Profile",
      signOut: "Sign out",
      language: "Language",
    },
    landing: {
      logIn: "Log in",
      getStarted: "Get Started",
      badge: "Now with AI-powered insights",
      heroTitle1: "Organize Your Work",
      heroTitle2: "Visualize Your Success",
      heroDescription:
        "A modern Kanban board that helps teams organize tasks, track progress, and collaborate seamlessly. Simple, powerful, and beautiful.",
      startForFree: "Start for Free",
      viewDemo: "View Demo",
      noCreditCard: "No credit card required · Free forever plan available",
      featuresTitle: "Everything You Need to Manage Projects",
      featuresSubtitle:
        "Powerful features that help teams stay organized and productive",
      featureVisualTitle: "Visual Task Management",
      featureVisualDesc:
        "Organize your work with intuitive drag-and-drop Kanban boards. Move tasks between columns with ease.",
      featureCollabTitle: "Team Collaboration",
      featureCollabDesc:
        "Invite team members to your boards. Assign tasks, leave comments, and track progress together.",
      featureRealtimeTitle: "Real-time Updates",
      featureRealtimeDesc:
        "See changes instantly as your team updates tasks. No need to refresh - everything syncs automatically.",
      featureSecureTitle: "Secure & Private",
      featureSecureDesc:
        "Your data is protected with enterprise-grade security. Only invited members can access your boards.",
      featureTrackingTitle: "Progress Tracking",
      featureTrackingDesc:
        "Visualize your team's productivity with clear column organization and task status at a glance.",
      featureAITitle: "AI-Powered Insights",
      featureAIDesc:
        "Get intelligent suggestions for task prioritization and workflow optimization.",
      howItWorksTitle: "Get Started in Minutes",
      howItWorksSubtitle: "Three simple steps to better project management",
      step1Title: "Create Your Board",
      step1Desc:
        "Sign up and create your first project board in seconds. Choose a name and start organizing your work.",
      step2Title: "Add Tasks",
      step2Desc:
        "Create tasks and organize them into columns like To Do, In Progress, and Done. Drag and drop to update status.",
      step3Title: "Collaborate",
      step3Desc:
        "Invite team members, assign tasks, and watch your project come together in real-time.",
      testimonialsTitle: "Loved by Teams Everywhere",
      testimonialsSubtitle:
        "See what our users have to say about their experience",
      ctaTitle: "Ready to Organize Your Work?",
      ctaDescription:
        "Join thousands of teams who use Kanban to manage their projects more effectively.",
      ctaButton: "Get Started for Free",
      footerAbout: "About",
      footerFeatures: "Features",
      footerPricing: "Pricing",
      footerContact: "Contact",
      footerCopyright: "© 2024 Kanban. All rights reserved.",
    },
    profile: {
      title: "Profile Settings",
      backToBoard: "Back to board",
    },
    newBoard: {
      title: "Create Your First Board",
      description:
        "Give your project a name and start organizing your tasks",
      projectName: "Project Name",
      placeholder: "e.g. Website Redesign, Mobile App",
      creating: "Creating...",
      createBoard: "Create Board",
    },
    login: {
      welcomeBack: "Welcome back",
      signInDescription: "Sign in to your account to continue",
      email: "Email",
      emailPlaceholder: "you@example.com",
      password: "Password",
      signIn: "Sign In",
      signingIn: "Signing in...",
      noAccount: "Don't have an account?",
      signUp: "Sign up",
      orContinueWith: "Or continue with",
      continueWithGoogle: "Continue with Google",
      continueWithGithub: "Continue with GitHub",
      createAccount: "Create account",
      createAccountDescription: "Enter your details to get started",
      fullName: "Full Name",
      fullNamePlaceholder: "John Doe",
      confirmPassword: "Confirm Password",
      creatingAccount: "Creating account...",
      haveAccount: "Already have an account?",
      passwordMismatch: "Passwords do not match",
      forgotPassword: "Forgot password?",
      resetPassword: "Reset Password",
      sendResetLink: "Send Reset Link",
      sending: "Sending...",
      resetSent: "Check your email for a password reset link.",
      backToSignIn: "Back to sign in",
    },
    columnNames: {
      backlog: "Backlog",
      todo: "To Do",
      inProgress: "In Progress",
      done: "Done",
    },
  },
  "zh-CN": {
    common: {
      loading: "加载中...",
      cancel: "取消",
      delete: "删除",
      save: "保存",
      create: "创建",
      confirm: "确认",
    },
    header: {
      home: "首页",
      kanban: "看板",
      selectProject: "选择项目",
      noProjectsYet: "暂无项目",
      newProject: "新建项目",
      signOut: "退出登录",
      deleteBoard: "删除看板",
    },
    createDialog: {
      title: "创建新项目",
      description: "创建一个新的看板来管理你的任务。",
      projectName: "项目名称",
      placeholder: "例如：网站重构",
      cancel: "取消",
      creating: "创建中...",
      create: "创建项目",
    },
    deleteDialog: {
      title: "删除看板",
      description: (name) =>
        `确定要删除「${name}」吗？这将永久移除所有列和任务，此操作无法撤销。`,
      cancel: "取消",
      deleting: "删除中...",
      delete: "删除看板",
    },
    kanban: {
      configError: "配置错误",
      configErrorDetail: "请配置 Supabase 环境变量",
      configErrorHint: "请确保你已配置好 Supabase 项目和环境变量。",
      noColumnsYet: "暂无列",
      initializeBoard: "初始化看板",
    },
    column: {
      noTasks: "暂无任务",
      addTask: "添加任务",
    },
    taskDialog: {
      editTask: "编辑任务",
      createNewTask: "创建新任务",
      title: "标题",
      titlePlaceholder: "输入任务标题",
      description: "描述",
      descriptionPlaceholder: "输入任务描述（可选）",
      column: "列",
      delete: "删除",
      cancel: "取消",
      saveChanges: "保存更改",
      createTask: "创建任务",
    },
    userButton: {
      settings: "设置",
      profile: "个人资料",
      signOut: "退出登录",
      language: "语言",
    },
    landing: {
      logIn: "登录",
      getStarted: "立即开始",
      badge: "现已支持 AI 智能洞察",
      heroTitle1: "高效管理工作",
      heroTitle2: "可视化你的成功",
      heroDescription:
        "一款现代化看板工具，帮助团队组织任务、追踪进度、无缝协作。简洁、强大、美观。",
      startForFree: "免费开始",
      viewDemo: "查看演示",
      noCreditCard: "无需信用卡 · 永久免费方案可用",
      featuresTitle: "项目管理所需的一切",
      featuresSubtitle: "强大的功能，帮助团队保持高效与有序",
      featureVisualTitle: "可视化任务管理",
      featureVisualDesc:
        "通过直观的拖拽式看板来组织工作，轻松在列之间移动任务。",
      featureCollabTitle: "团队协作",
      featureCollabDesc:
        "邀请团队成员加入看板，分配任务、留下评论、共同追踪进度。",
      featureRealtimeTitle: "实时更新",
      featureRealtimeDesc:
        "当团队成员更新任务时即时看到变化，无需刷新——一切自动同步。",
      featureSecureTitle: "安全与隐私",
      featureSecureDesc:
        "你的数据受到企业级安全保护，只有被邀请的成员才能访问你的看板。",
      featureTrackingTitle: "进度追踪",
      featureTrackingDesc:
        "通过清晰的列组织和任务状态一览，可视化团队的工作效率。",
      featureAITitle: "AI 智能洞察",
      featureAIDesc: "获取智能建议，优化任务优先级和工作流程。",
      howItWorksTitle: "几分钟即可上手",
      howItWorksSubtitle: "三个简单步骤，开启更好的项目管理",
      step1Title: "创建看板",
      step1Desc:
        "注册并在几秒内创建你的第一个项目看板。选择名称，开始组织工作。",
      step2Title: "添加任务",
      step2Desc:
        "创建任务并将它们组织到「待办」「进行中」「已完成」等列中，拖拽即可更新状态。",
      step3Title: "团队协作",
      step3Desc:
        "邀请团队成员，分配任务，实时见证项目的推进。",
      testimonialsTitle: "深受各团队喜爱",
      testimonialsSubtitle: "看看用户们怎么说",
      ctaTitle: "准备好高效管理工作了吗？",
      ctaDescription:
        "加入数千个团队，使用看板更高效地管理项目。",
      ctaButton: "免费开始使用",
      footerAbout: "关于我们",
      footerFeatures: "功能特性",
      footerPricing: "定价方案",
      footerContact: "联系我们",
      footerCopyright: "© 2024 Kanban. 保留所有权利。",
    },
    profile: {
      title: "个人设置",
      backToBoard: "返回看板",
    },
    newBoard: {
      title: "创建你的第一个看板",
      description: "为你的项目命名，开始组织任务",
      projectName: "项目名称",
      placeholder: "例如：网站重构、移动端应用",
      creating: "创建中...",
      createBoard: "创建看板",
    },
    login: {
      welcomeBack: "欢迎回来",
      signInDescription: "登录你的账户以继续",
      email: "邮箱",
      emailPlaceholder: "you@example.com",
      password: "密码",
      signIn: "登录",
      signingIn: "登录中...",
      noAccount: "还没有账户？",
      signUp: "注册",
      orContinueWith: "或通过以下方式继续",
      continueWithGoogle: "使用 Google 继续",
      continueWithGithub: "使用 GitHub 继续",
      createAccount: "创建账户",
      createAccountDescription: "输入你的信息以开始使用",
      fullName: "姓名",
      fullNamePlaceholder: "张三",
      confirmPassword: "确认密码",
      creatingAccount: "创建账户中...",
      haveAccount: "已有账户？",
      passwordMismatch: "两次密码输入不一致",
      forgotPassword: "忘记密码？",
      resetPassword: "重置密码",
      sendResetLink: "发送重置链接",
      sending: "发送中...",
      resetSent: "请查看你的邮箱以获取密码重置链接。",
      backToSignIn: "返回登录",
    },
    columnNames: {
      backlog: "积压",
      todo: "待办",
      inProgress: "进行中",
      done: "已完成",
    },
  },
}

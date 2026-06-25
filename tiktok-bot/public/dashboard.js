// React double-click file fallback handler
if (window.location.protocol === 'file:') {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = 'http://localhost:3000' + input;
    }
    return originalFetch(input, init);
  };
}
function App() {
  const [activeTab, setActiveTab] = React.useState('configuracion');
  const [activeSub, setActiveSub] = React.useState('player');
  const [activeConfigSub, setActiveConfigSub] = React.useState('commands');
  const [saveStatus, setSaveStatus] = React.useState('');

  // System Configurations
  const [config, setConfig] = React.useState({
    tiktokUsername: '',
    sessionId: '',
    ttTargetIdc: '',
    minCoinsForVip: 30,
    requireVipForSr: false,
    allowPointsCommand: true,
    likesPerPoint: 120,
    allowSubscribers: false,
    allowModerators: false,
    allowSuperFans: false,
    ciderUrl: 'http://localhost:10767',
    ignoreExampleQuery: 'artista cancion',
    commandAliases: []
  });
  const [initialConfig, setInitialConfig] = React.useState(null);

  // Overlays Alert / Visual Configurations
  const [overlays, _setOverlays] = React.useState({
    enableFollowAlert: true,
    enableSubscribeAlert: true,
    enableLikeAlert: true,
    enableGiftAlert: true,
    enableLikesYoutubeLock: true,
    likesTargetForYoutubeLink: 999,
    likesLockAlertMsg: "🔒 Enlaces bloqueados: Faltan {faltan} likes en el Live (llevamos {llevamos}/{meta}) ❤️",
    minLikesAlert: 100,
    minCoinsAlert: 5,
    likesAlertMsg: "¡Envió {likes} likes! ❤️",
    giftsAlertMsg: "¡Gracias por {repeatCount}x {giftName}! 🎁",
    followsAlertMsg: "¡gracias por seguir el canal! 👤",
    subsAlertMsg: "¡gracias por suscribirte al canal! ⭐",
    rainbowText: true,
    bounceText: true,
    showLottie: true,
    playAudio: true,
    ttsEnabled: true,
    // Followers Alert Specific Config
    followOpacity: 0.85,
    followRadius: 22,
    followFontSize: 14,
    followShowLottie: true,
    followPlayAudio: true,
    followAudioVolume: 50,
    followTtsEnabled: false,
    followRainbowText: false,
    followBounceText: true,
    followShowCard: true,
    followFontFamily: 'Outfit',
    followTextShadow: '3d-retro',
    // Likes Alert Specific Config
    likeOpacity: 0.85,
    likeRadius: 22,
    likeFontSize: 14,
    likeShowLottie: true,
    likePlayAudio: true,
    likeAudioVolume: 50,
    likeTtsEnabled: false,
    likeRainbowText: false,
    likeBounceText: true,
    likeShowCard: true,
    likeFontFamily: 'Outfit',
    likeTextShadow: '3d-retro',
    likeHeartSize: 190,
    likeUsernameSize: 35,
    likeMessageSize: 20,
    likeWrapperHeight: 290,
    // Gifts Alert Specific Config
    giftOpacity: 0.85,
    giftRadius: 22,
    giftFontSize: 14,
    giftShowLottie: true,
    giftPlayAudio: true,
    giftAudioVolume: 50,
    giftTtsEnabled: true,
    giftRainbowText: true,
    giftBounceText: true,
    giftShowCard: true,
    giftFontFamily: 'Outfit',
    giftTextShadow: '3d-retro',
    // Subscribe Alert Specific Config
    subscribeOpacity: 0.85,
    subscribeRadius: 22,
    subscribeFontSize: 14,
    subscribeShowLottie: true,
    subscribePlayAudio: true,
    subscribeAudioVolume: 50,
    subscribeTtsEnabled: true,
    subscribeRainbowText: true,
    subscribeBounceText: true,
    subscribeShowCard: true,
    subscribeFontFamily: 'Outfit',
    subscribeTextShadow: '3d-retro',
    // Welcome Overlay Config
    welcomeOverlayEnabled: true,
    welcomeOverlayDuration: 5,
    welcomeOverlayGreetingTemplate: "¡Acaba de entrar al Live! 👋",
    welcomeOverlayColor: "#a855f7",
    welcomeOverlaySoundEnabled: true,
    welcomeOverlaySoundVolume: 40,
    welcomeOverlayAllowAll: true,
    welcomeOverlayAllowFollowers: false,
    welcomeOverlayAllowSubscribers: false,
    welcomeOverlayAllowModerators: false,
    // Chat TTS Config
    chatTtsEnabled: false,
    chatTtsLanguage: "es-MX",
    chatTtsSpeed: 50,
    chatTtsPitch: 50,
    chatTtsVolume: 80,
    chatTtsRandomVoice: false,
    chatTtsVoice: "Default Voice",
    chatTtsAllowAll: true,
    chatTtsAllowFollowers: false,
    chatTtsAllowSubscribers: false,
    chatTtsAllowModerators: false,
    chatTtsAllowTeam: false,
    chatTtsAllowTopGifters: false,
    chatTtsType: "any",
    chatTtsCommand: "!tts",
    chatTtsFilterLetterSpam: true,
    chatTtsFilterMentions: true,
    chatTtsFilterCommands: true,
    chatTtsMaxCommentLength: 300,
    chatTtsUserCooldown: 0,
    chatTtsMaxQueueLength: 5,
    chatTtsChargePoints: false,
    chatTtsCost: 5,
    chatTtsUserCooldown: 0,
    chatTtsMaxQueueLength: 5,
    chatTtsMaxCommentLength: 300,
    chatTtsFilterLetterSpam: true,
    chatTtsFilterMentions: false,
    chatTtsFilterCommands: false,
    chatTtsMessageTemplate: "{nickname} dice {comment}",
    chatTtsSpecialUsers: [],
    topgifter_show_crown: true,
    topgifter_show_coin_symbol: true,
    topgifter_max: 10,
    topgifter_rainbow_username: false,
    topgifter_bounce_username: false,
    topgifter_bounce_coins: true,
    topgifter_rainbow_rank: false,
    topgifter_bounce_rank: false,
    topgifter_first_place_color: '#ffd700',
    topgifter_second_place_color: '#cbd5e1',
    topgifter_third_place_color: '#cd7f32',
    topliker_show_crown: true,
    topliker_show_heart_symbol: true,
    topliker_max: 10,
    topliker_rainbow_username: false,
    topliker_bounce_username: false,
    topliker_bounce_likes: true,
    topliker_rainbow_rank: false,
    topliker_bounce_rank: false,
    topliker_first_place_color: '#ff4d6d',
    topliker_second_place_color: '#cbd5e1',
    topliker_third_place_color: '#fb923c',
    topliker_inactivity_threshold: 90,
    // Specific customization elements
    playerOpacity: 0.78,
    playerRadius: 20,
    playerFontSize: 14,
    playerColor: '#ff0050',
    playerShowCardBg: true,
    playerBorderColor: '#ffffff',
    playerBorderWidth: 1,
    playerBorderOpacity: 15,
    playerBorderStyle: 'solid',
    playerShowAccentBorder: true,
    playerAccentBorderWidth: 6,
    playerShowShadow: true,
    playerShadowColor: '#000000',
    playerShadowBlur: 30,
    playerShadowOpacity: 50,
    queueOpacity: 0.80,
    queueRadius: 22,
    queueFontSize: 14,
    queueShowCardBg: true,
    queueBorderColor: '#ffffff',
    queueBorderWidth: 1,
    queueBorderOpacity: 15,
    queueBorderStyle: 'solid',
    queueShowAccentBorder: true,
    queueAccentBorderWidth: 5,
    queueShowShadow: true,
    queueShadowColor: '#000000',
    queueShadowBlur: 15,
    queueShadowOpacity: 40,
    queueShowSweepBorder: true,
    rouletteOpacity: 0.90,
    rouletteRadius: 22,
    rouletteShowCardBg: true,
    rouletteBorderColor: '#ffffff',
    rouletteBorderWidth: 1,
    rouletteBorderOpacity: 20,
    rouletteBorderStyle: 'solid',
    rouletteShowShadow: true,
    rouletteOverlayEnabled: true,
    alertsOpacity: 0.85,
    alertsRadius: 22,
    alertsFontSize: 14,
    followBorderColor: '#ffffff',
    followBorderWidth: 1,
    followBorderOpacity: 8,
    followBorderStyle: 'solid',
    likeBorderColor: '#ffffff',
    likeBorderWidth: 1,
    likeBorderOpacity: 8,
    likeBorderStyle: 'solid',
    giftBorderColor: '#ffffff',
    giftBorderWidth: 1,
    giftBorderOpacity: 8,
    giftBorderStyle: 'solid',
    subscribeBorderColor: '#ffffff',
    subscribeBorderWidth: 1,
    subscribeBorderOpacity: 8,
    subscribeBorderStyle: 'solid',
    topgifterOpacity: 0.85,
    topgifterRadius: 22,
    topgifterFontSize: 14,
    topgifterShowCardBg: true,
    topgifterWidth: 340,
    topgifterGap: 6,
    topgifterCardPadding: 'medium',
    topgifterBorderColor: '#ffffff',
    topgifterBorderWidth: 1,
    topgifterBorderOpacity: 7,
    topgifterBorderStyle: 'solid',
    topgifterShowShadow: true,
    topgifterShadowColor: '#000000',
    topgifterShadowBlur: 20,
    topgifterShadowOpacity: 35,
    topgifterAnimationDuration: 0.35,
    toplikerOpacity: 0.85,
    toplikerRadius: 22,
    toplikerFontSize: 14,
    toplikerShowCardBg: true,
    toplikerWidth: 340,
    toplikerGap: 6,
    toplikerCardPadding: 'medium',
    toplikerBorderColor: '#ffffff',
    toplikerBorderWidth: 1,
    toplikerBorderOpacity: 7,
    toplikerBorderStyle: 'solid',
    toplikerShowShadow: true,
    toplikerShadowColor: '#000000',
    toplikerShadowBlur: 20,
    toplikerShadowOpacity: 35,
    toplikerAnimationDuration: 0.35,
    likeslockOpacity: 0.85,
    likeslockRadius: 22,
    tickerOpacity: 0.85,
    tickerFontSize: 14
  });
  const [dirtyKeys, setDirtyKeys] = React.useState({});
  const [availableVoices, setAvailableVoices] = React.useState([]);
  const [voices, setVoices] = React.useState([]);
  const [ttsLogs, setTtsLogs] = React.useState([]);
  const [testerText, setTesterText] = React.useState('This is a test!');
  const [specialUserSearch, setSpecialUserSearch] = React.useState('');
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);
  React.useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        setVoices(window.speechSynthesis.getVoices());
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);
  const setOverlays = React.useCallback(val => {
    if (typeof val === 'function') {
      _setOverlays(prev => {
        const next = val(prev);
        const changes = {};
        for (const k in next) {
          if (next[k] !== prev[k]) {
            changes[k] = true;
          }
        }
        if (Object.keys(changes).length > 0) {
          setDirtyKeys(d => ({
            ...d,
            ...changes
          }));
        }
        return next;
      });
    } else {
      _setOverlays(prev => {
        const next = {
          ...prev,
          ...val
        };
        const changes = {};
        for (const k in next) {
          if (next[k] !== prev[k]) {
            changes[k] = true;
          }
        }
        if (Object.keys(changes).length > 0) {
          setDirtyKeys(d => ({
            ...d,
            ...changes
          }));
        }
        return next;
      });
    }
  }, []);

  // Goals Config
  const [goals, setGoals] = React.useState({
    follows: {
      goalTarget: 500,
      goalLabel: '¡Meta de seguidores!',
      goalRewardText: '¡Meta alcanzada! 🎉',
      primaryColor: '#7c3aed',
      enabled: true,
      goalsOpacity: 0.85,
      goalsRadius: 22
    },
    likes: {
      goalTarget: 10000,
      goalLabel: '¡Meta de likes!',
      goalRewardText: '¡Meta alcanzada! 🎉',
      primaryColor: '#ec4899',
      enabled: true,
      goalsOpacity: 0.85,
      goalsRadius: 22
    },
    shares: {
      goalTarget: 100,
      goalLabel: '¡Meta de compartidos!',
      goalRewardText: '¡Meta alcanzada! 🎉',
      primaryColor: '#10b981',
      enabled: true,
      goalsOpacity: 0.85,
      goalsRadius: 22
    },
    coins: {
      goalTarget: 500,
      goalLabel: '¡Meta de monedas!',
      goalRewardText: '¡Meta alcanzada! 🎉',
      primaryColor: '#eab308',
      enabled: true,
      goalsOpacity: 0.85,
      goalsRadius: 22
    }
  });

  // Timer state settings
  const [timer, setTimer] = React.useState({
    label: '⏳ Tiempo de stream',
    primaryColor: '#7c3aed',
    secondsPerGift: 30,
    timerOpacity: 0.85,
    timerRadius: 22,
    timerFontSize: 14,
    // running controllers
    initialDuration: 30
  });

  // Last events widget configurations
  const [lastevents, setLastevents] = React.useState({
    cardOpacity: 0.55,
    borderRadius: 14,
    fontSize: 13,
    showFollows: true,
    showGifts: true,
    showLikes: true,
    showShares: true,
    showSubscribes: true,
    maxEvents: 6,
    showAvatar: true
  });

  // Live status stats
  const [status, setStatus] = React.useState({
    ciderConnected: false,
    tiktokState: 'unknown',
    isConnecting: false,
    isRetrying: false,
    lastConnectionError: '',
    mockCiderActive: false,
    mockCiderPort: 10767,
    queueLength: 0
  });
  const [timerDisplay, setTimerDisplay] = React.useState('Cargando...');

  // Testing offline modes states
  const [offlineTest, setOfflineTest] = React.useState({
    mode: 'manual',
    // manual or search
    user: 'Prueba',
    appleMusicId: '',
    song: '',
    artist: '',
    message: '',
    sendToCider: true,
    sendToQueue: false,
    resultText: ''
  });

  // Mock Cider state values
  const [mockCider, setMockCider] = React.useState({
    requester: 'Zero',
    appleMusicId: '',
    song: 'MONACO',
    artist: 'Bad Bunny',
    resultText: ''
  });

  // Gift simulation state values
  const [giftTest, setGiftTest] = React.useState({
    user: 'DonadorPremium',
    giftName: 'TikTok Rose',
    coins: 10,
    seconds: '',
    resultText: ''
  });
  const [currentOrigin, setCurrentOrigin] = React.useState('http://localhost:3000');

  // MODAL STATES FOR PERSONALIZATION OVERLAYS
  const [showFollowPersonalize, setShowFollowPersonalize] = React.useState(false);
  const [showLikesPersonalize, setShowLikesPersonalize] = React.useState(false);
  const [showGiftPersonalize, setShowGiftPersonalize] = React.useState(false);
  const [showSubscribePersonalize, setShowSubscribePersonalize] = React.useState(false);
  const [showGoalsFollowsPersonalize, setShowGoalsFollowsPersonalize] = React.useState(false);
  const [showGoalsLikesPersonalize, setShowGoalsLikesPersonalize] = React.useState(false);
  const [showGoalsSharesPersonalize, setShowGoalsSharesPersonalize] = React.useState(false);
  const [showGoalsCoinsPersonalize, setShowGoalsCoinsPersonalize] = React.useState(false);
  const [showTopgifterPersonalize, setShowTopgifterPersonalize] = React.useState(false);
  const [showToplikerPersonalize, setShowToplikerPersonalize] = React.useState(false);
  const [newSpecialUser, setNewSpecialUser] = React.useState({
    username: '',
    allowed: true,
    voice: 'Default Voice',
    speed: 50,
    pitch: 50
  });

  // Coordinates for modals
  const [followModalPos, setFollowModalPos] = React.useState({
    x: 100,
    y: 150
  });
  const [likesModalPos, setLikesModalPos] = React.useState({
    x: 150,
    y: 180
  });
  const [giftModalPos, setGiftModalPos] = React.useState({
    x: 200,
    y: 200
  });
  const [subscribeModalPos, setSubscribeModalPos] = React.useState({
    x: 250,
    y: 220
  });
  const [goalsFollowsModalPos, setGoalsFollowsModalPos] = React.useState({
    x: 300,
    y: 150
  });
  const [goalsLikesModalPos, setGoalsLikesModalPos] = React.useState({
    x: 340,
    y: 180
  });
  const [goalsSharesModalPos, setGoalsSharesModalPos] = React.useState({
    x: 380,
    y: 210
  });
  const [goalsCoinsModalPos, setGoalsCoinsModalPos] = React.useState({
    x: 420,
    y: 240
  });
  const [topgifterModalPos, setTopgifterModalPos] = React.useState({
    x: 200,
    y: 150
  });
  const [toplikerModalPos, setToplikerModalPos] = React.useState({
    x: 250,
    y: 180
  });

  // Dragging references
  const dragInfo = React.useRef({
    active: null,
    // 'follow', 'likes', 'gift', 'subscribe', 'goals_follows', 'goals_likes', 'goals_shares', 'goals_coins', 'topgifter'
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0
  });
  const handleMouseDownFollowModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'follow',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: followModalPos.x,
      startTop: followModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownLikesModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'likes',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: likesModalPos.x,
      startTop: likesModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownGiftModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'gift',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: giftModalPos.x,
      startTop: giftModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownSubscribeModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'subscribe',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: subscribeModalPos.x,
      startTop: subscribeModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownGoalsFollowsModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'goals_follows',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: goalsFollowsModalPos.x,
      startTop: goalsFollowsModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownGoalsLikesModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'goals_likes',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: goalsLikesModalPos.x,
      startTop: goalsLikesModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownGoalsSharesModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'goals_shares',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: goalsSharesModalPos.x,
      startTop: goalsSharesModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownGoalsCoinsModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'goals_coins',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: goalsCoinsModalPos.x,
      startTop: goalsCoinsModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownTopgifterModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'topgifter',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: topgifterModalPos.x,
      startTop: topgifterModalPos.y
    };
    e.preventDefault();
  };
  const handleMouseDownToplikerModal = e => {
    if (e.target.closest('.btn-close-modal') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    dragInfo.current = {
      active: 'topliker',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: toplikerModalPos.x,
      startTop: toplikerModalPos.y
    };
    e.preventDefault();
  };

  // Master dragging listener
  React.useEffect(() => {
    const handleMouseMove = e => {
      const drag = dragInfo.current;
      if (!drag.active) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (drag.active === 'follow') {
        setFollowModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'likes') {
        setLikesModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'gift') {
        setGiftModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'subscribe') {
        setSubscribeModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'goals_follows') {
        setGoalsFollowsModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'goals_likes') {
        setGoalsLikesModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'goals_shares') {
        setGoalsSharesModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'goals_coins') {
        setGoalsCoinsModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'topgifter') {
        setTopgifterModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      } else if (drag.active === 'topliker') {
        setToplikerModalPos({
          x: drag.startLeft + dx,
          y: drag.startTop + dy
        });
      }
    };
    const handleMouseUp = () => {
      dragInfo.current.active = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [followModalPos, likesModalPos, giftModalPos, subscribeModalPos, goalsFollowsModalPos, goalsLikesModalPos, goalsSharesModalPos, goalsCoinsModalPos, topgifterModalPos, toplikerModalPos]);

  // Broadcast real-time config updates to the 4 preview iframes
  React.useEffect(() => {
    const iframes = ['iframe-alerts-follow', 'iframe-alerts-like', 'iframe-alerts-gift', 'iframe-alerts-subscribe'];
    const timerId = setTimeout(() => {
      iframes.forEach(id => {
        const iframe = document.getElementById(id);
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            action: 'updateLiveConfig',
            config: overlays
          }, '*');
        }
      });
    }, 50); // slight debounce for smooth dragging updates

    return () => clearTimeout(timerId);
  }, [overlays]);
  React.useEffect(() => {
    const origin = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
    setCurrentOrigin(origin);

    // Load all initial configurations
    fetch('/api/config').then(r => r.json()).then(data => {
      setConfig(prev => {
        const next = {
          ...prev,
          ...data,
          commandAliases: data.commandAliases || ["!sr", "!pedir", "!cancion"]
        };
        setInitialConfig(next);
        return next;
      });
    }).catch(() => {});
    fetch('/api/overlays/config').then(r => r.json()).then(data => {
      try {
        localStorage.setItem('offline_overlays_config', JSON.stringify(data));
      } catch (_) {}
      _setOverlays(prev => ({
        ...prev,
        ...data
      }));
    }).catch(() => {
      // Si el bot está apagado, cargamos la configuración localmente
      const local = localStorage.getItem('offline_overlays_config');
      if (local) {
        try {
          _setOverlays(prev => ({
            ...prev,
            ...JSON.parse(local)
          }));
        } catch (_) {}
      }
    });
    fetch('/api/goals/config').then(r => r.json()).then(data => {
      try {
        localStorage.setItem('offline_goals_config', JSON.stringify(data));
      } catch (_) {}

      // Asegurar estructura de 4 metas
      setGoals(prev => {
        const merged = {
          ...prev
        };
        const types = ['follows', 'likes', 'shares', 'coins'];
        types.forEach(t => {
          if (data[t]) {
            merged[t] = {
              ...prev[t],
              ...data[t]
            };
          } else if (data.goalType === t) {
            // Migración de datos planos anteriores
            merged[t] = {
              goalTarget: data.goalTarget || prev[t].goalTarget,
              goalLabel: data.goalLabel || prev[t].goalLabel,
              goalRewardText: data.goalRewardText || prev[t].goalRewardText,
              primaryColor: data.primaryColor || prev[t].primaryColor,
              enabled: data.enabled !== undefined ? data.enabled : prev[t].enabled,
              goalsOpacity: data.goalsOpacity !== undefined ? data.goalsOpacity : prev[t].goalsOpacity,
              goalsRadius: data.goalsRadius !== undefined ? data.goalsRadius : prev[t].goalsRadius
            };
          }
        });
        return merged;
      });
    }).catch(() => {
      const local = localStorage.getItem('offline_goals_config');
      if (local) {
        try {
          setGoals(prev => ({
            ...prev,
            ...JSON.parse(local)
          }));
        } catch (_) {}
      }
    });
    fetch('/api/timer/state').then(r => r.json()).then(data => {
      setTimer(prev => ({
        ...prev,
        label: data.label || '⏳ Tiempo de stream',
        primaryColor: data.primaryColor || '#7c3aed',
        secondsPerGift: data.secondsPerGift || 30,
        timerOpacity: data.timerOpacity !== undefined ? data.timerOpacity : 0.85,
        timerRadius: data.timerRadius !== undefined ? data.timerRadius : 22,
        timerFontSize: data.timerFontSize !== undefined ? data.timerFontSize : 14
      }));
    }).catch(() => {});
    fetch('/api/lastevents/config').then(r => r.json()).then(data => {
      setLastevents(prev => ({
        ...prev,
        ...data
      }));
    }).catch(() => {});
  }, []);

  // Polling of live bot and timer display statuses
  React.useEffect(() => {
    const getStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        let queueLen = 0;
        try {
          const r2 = await fetch('/api/mockcider/status');
          const d2 = await r2.json();
          queueLen = Number(d2.queueLength || 0) || 0;
        } catch (_) {}
        setStatus({
          ciderConnected: !!data.ciderConnected,
          tiktokState: data.tiktokState || 'unknown',
          isConnecting: !!data.isConnecting,
          isRetrying: !!data.isRetrying,
          lastConnectionError: data.lastConnectionError || '',
          mockCiderActive: !!data.mockCiderActive,
          mockCiderPort: data.mockCiderPort || 10767,
          queueLength: queueLen
        });
      } catch (_) {}
    };
    const getTimerState = async () => {
      try {
        const res = await fetch('/api/timer/state');
        const data = await res.json();
        const ms = Number(data.remainingMs || 0);
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor(totalSec % 3600 / 60);
        const s = totalSec % 60;
        const timeStr = h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        const stateEmoji = {
          running: '▶️',
          paused: '⏸️',
          stopped: '⏹️'
        }[data.state] || '❓';
        setTimerDisplay(`Estado: ${stateEmoji} ${data.state} | Tiempo restante: ${timeStr}`);
      } catch (_) {}
    };
    getStatus();
    getTimerState();
    const statsInterval = setInterval(getStatus, 1500);
    const timerInterval = setInterval(getTimerState, 5000);
    return () => {
      clearInterval(statsInterval);
      clearInterval(timerInterval);
    };
  }, []);

  // Función para enviar configuraciones en tiempo real a los iframes
  const sendConfigToIframe = (iframeId, configData) => {
    const iframe = document.getElementById(iframeId);
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        action: 'updateConfig',
        payload: configData
      }, '*');
    }
  };

  // Sincronización en tiempo real con las vistas previas al deslizar sliders
  React.useEffect(() => {
    const timerId = setTimeout(() => {
      if (activeSub === 'player') {
        sendConfigToIframe('iframe-player', overlays);
      } else if (activeSub === 'queue') {
        sendConfigToIframe('iframe-queue', overlays);
      } else if (activeSub === 'roulette') {
        sendConfigToIframe('iframe-roulette', overlays);
      } else if (activeSub === 'alerts') {
        sendConfigToIframe('iframe-alerts', overlays);
      } else if (activeSub === 'topgifters') {
        sendConfigToIframe('iframe-topgifters', overlays);
      } else if (activeSub === 'toplikers') {
        sendConfigToIframe('iframe-toplikers', overlays);
      } else if (activeSub === 'ticker') {
        sendConfigToIframe('iframe-ticker', overlays);
      } else if (activeSub === 'goals') {
        sendConfigToIframe('iframe-goals-follows', goals.follows);
        sendConfigToIframe('iframe-goals-likes', goals.likes);
        sendConfigToIframe('iframe-goals-shares', goals.shares);
        sendConfigToIframe('iframe-goals-coins', goals.coins);
      } else if (activeSub === 'timer') {
        sendConfigToIframe('iframe-timer', timer);
      } else if (activeSub === 'lastevents') {
        sendConfigToIframe('iframe-lastevents', lastevents);
      } else if (activeSub === 'welcome') {
        sendConfigToIframe('iframe-welcome', overlays);
      }
    }, 80);
    return () => clearTimeout(timerId);
  }, [overlays, goals, timer, lastevents, activeSub]);

  // Helper centralizado para guardar configuración de overlays mezclando solo lo modificado ("dirty")
  const saveOverlaysConfig = async (localOverlays, extraDirtyKeys = {}) => {
    try {
      // 1. Obtener la configuración fresca de la nube para no pisar cambios locales de OBS
      const freshRes = await fetch('/api/overlays/config');
      const freshData = await freshRes.json();

      // 2. Combinar solo las propiedades modificadas ("dirty") en esta sesión del dashboard
      const mergedOverlays = {
        ...freshData
      };
      const allDirty = {
        ...dirtyKeys,
        ...extraDirtyKeys
      };
      for (const k in allDirty) {
        if (allDirty[k]) {
          mergedOverlays[k] = localOverlays[k];
        }
      }

      // 3. Guardar en la nube
      const res = await fetch('/api/overlays/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mergedOverlays)
      });
      const data = await res.json();
      if (data.success) {
        // Actualizar estado local y limpiar dirty keys
        _setOverlays(mergedOverlays);
        setDirtyKeys({});
        return true;
      }
    } catch (e) {
      console.error("Error al guardar configuración de overlays:", e);
    }
    return false;
  };

  // Save Global configuration
  const handleSaveGlobalConfig = async () => {
    localStorage.setItem('offline_overlays_config', JSON.stringify(overlays));
    try {
      const res1 = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      const d1 = await res1.json();
      const success2 = await saveOverlaysConfig(overlays);
      if (d1.success && success2) {
        triggerSaveBadge('💾 ¡Cambios Guardados!');
      } else {
        triggerSaveBadge('💾 Guardado en navegador (Offline)');
      }
      setInitialConfig(config);
    } catch (e) {
      triggerSaveBadge('💾 ¡Guardado en navegador (Offline)!');
      setInitialConfig(config);
    }
  };
  const handleToggleTikTok = async () => {
    const isConnectedOrConnecting = status.tiktokState === 'connected' || status.isConnecting || status.isRetrying;
    if (isConnectedOrConnecting) {
      try {
        const res = await fetch('/api/tiktok/disconnect', {
          method: 'POST'
        });
        const d = await res.json();
        if (d.ok) {
          setStatus(prev => ({
            ...prev,
            tiktokState: 'disconnected',
            isConnecting: false,
            isRetrying: false,
            lastConnectionError: ''
          }));
        }
      } catch (e) {
        console.error("Error al desconectar:", e);
      }
    } else {
      try {
        setStatus(prev => ({
          ...prev,
          isConnecting: true
        }));
        const res = await fetch('/api/tiktok/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tiktokUsername: config.tiktokUsername,
            sessionId: config.sessionId
          })
        });
        const d = await res.json();
        if (!d.ok) {
          setStatus(prev => ({
            ...prev,
            isConnecting: false
          }));
          alert('Error al conectar: ' + d.error);
        }
      } catch (e) {
        setStatus(prev => ({
          ...prev,
          isConnecting: false
        }));
        console.error("Error al conectar:", e);
      }
    }
  };
  const handleShutdownServer = async () => {
    if (confirm('¿Estás seguro de que quieres apagar el servidor del bot por completo?\n\nLa página dejará de funcionar y tendrás que iniciarlo manualmente desde tu PC para volver a entrar.')) {
      try {
        const res = await fetch('/api/server/shutdown', {
          method: 'POST'
        });
        const d = await res.json();
        if (d.ok) {
          alert('El servidor se está apagando. Esta pestaña ya no responderá.');
          window.location.reload();
        }
      } catch (e) {
        alert('El servidor se ha apagado con éxito.');
        window.location.reload();
      }
    }
  };
  const triggerSaveBadge = msg => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Custom specific Overlay config saves
  const handleSaveOverlaysConfigOnly = async (subpanel = '') => {
    localStorage.setItem('offline_overlays_config', JSON.stringify(overlays));
    const success = await saveOverlaysConfig(overlays);
    if (success) {
      triggerSaveBadge(`💾 Diseño de ${subpanel} guardado`);
    } else {
      triggerSaveBadge(`💾 ${subpanel}: Guardado en navegador (Offline)`);
    }
  };

  // Goal config save
  const handleSaveGoalsConfig = async (type = '') => {
    // Guardar localmente primero
    localStorage.setItem('offline_goals_config', JSON.stringify(goals));
    const typeLabels = {
      follows: 'Seguidores',
      likes: 'Likes',
      shares: 'Compartidos',
      coins: 'Monedas'
    };
    const label = typeLabels[type] || '';
    const badgeMsg = label ? `🎯 Meta de ${label} guardada` : '🎯 ¡Meta guardada!';
    const offlineMsg = label ? `💾 Meta de ${label}: Guardada (Offline)` : '💾 Meta: Guardada en navegador (Offline)';
    try {
      const res = await fetch('/api/goals/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(goals)
      });
      const data = await res.json();
      triggerSaveBadge(badgeMsg);
    } catch (e) {
      triggerSaveBadge(offlineMsg);
    }
  };

  // Timer visual config save
  const handleSaveTimerConfigOnly = async () => {
    try {
      const res = await fetch('/api/timer/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(timer)
      });
      const data = await res.json();
      if (data.success) {
        triggerSaveBadge('⏱️ Diseño de Timer guardado');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Last events config save
  const handleSaveLastEventsConfig = async () => {
    try {
      const res = await fetch('/api/lastevents/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(lastevents)
      });
      const data = await res.json();
      if (data.success) {
        triggerSaveBadge('📋 Diseño de Feed guardado');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Copy OBS URL to clipboard
  const handleCopyUrl = url => {
    navigator.clipboard.writeText(url).then(() => {
      alert('¡Enlace de OBS copiado al portapapeles! 📋');
    }).catch(() => {
      alert('No se pudo copiar, por favor hazlo manualmente.');
    });
  };

  // Event simulation triggers
  const triggerOverlayTest = async (type, customText) => {
    // Petición al bot en segundo plano (para que OBS también lo capte si está online)
    try {
      fetch('/api/overlays/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          customText
        })
      }).catch(() => {});
    } catch (e) {}

    // Enviar al iframe correspondiente para pruebas offline instantáneas
    let iframeId = 'iframe-alerts';
    if (type === 'follow') iframeId = 'iframe-alerts-follow';else if (type === 'like') iframeId = 'iframe-alerts-like';else if (type === 'gift_rose' || type === 'gift_lion') iframeId = 'iframe-alerts-gift';else if (type === 'subscribe') iframeId = 'iframe-alerts-subscribe';else if (type === 'like_lock_blocked') iframeId = 'iframe-alerts-like';else if (type === 'topgifters') iframeId = 'iframe-topgifters';else if (type === 'toplikers') iframeId = 'iframe-toplikers';
    const iframe = document.getElementById(iframeId);
    if (iframe && iframe.contentWindow) {
      if (type === 'topgifters') {
        iframe.contentWindow.postMessage({
          action: 'triggerTestTopGifters'
        }, '*');
      } else if (type === 'toplikers') {
        iframe.contentWindow.postMessage({
          action: 'triggerTestTopLikers'
        }, '*');
      } else {
        const payloads = {
          follow: {
            type: 'follow',
            user: 'PruebaSeguidor',
            message: overlays.followsAlertMsg || '¡gracias por seguir el canal! 👤',
            profilePic: 'https://i.pravatar.cc/100?img=21'
          },
          like: {
            type: 'like',
            user: 'PruebaLikes',
            message: (overlays.likesAlertMsg || '¡Envió {likes} likes! ❤️').replace('{likes}', '150'),
            profilePic: 'https://i.pravatar.cc/100?img=47'
          },
          gift_rose: {
            type: 'gift',
            user: 'PruebaRegalo',
            giftName: 'Rosa',
            coins: 1,
            repeatCount: 1,
            message: (overlays.giftsAlertMsg || '¡Gracias por {repeatCount}x {giftName}! 🎁').replace('{giftName}', 'Rosa').replace('{repeatCount}', '1'),
            profilePic: 'https://i.pravatar.cc/100?img=12'
          },
          gift_lion: {
            type: 'gift',
            user: 'PruebaRegalo',
            giftName: 'León',
            coins: 2999,
            repeatCount: 1,
            message: (overlays.giftsAlertMsg || '¡Gracias por {repeatCount}x {giftName}! 🎁').replace('{giftName}', 'León').replace('{repeatCount}', '1'),
            profilePic: 'https://i.pravatar.cc/100?img=12'
          },
          subscribe: {
            type: 'subscribe',
            user: 'PruebaSubs',
            message: overlays.subsAlertMsg || '¡gracias por suscribirte al canal! ⭐',
            profilePic: 'https://i.pravatar.cc/100?img=33'
          },
          like_lock_blocked: {
            type: 'like',
            user: 'YouTube Link',
            message: overlays.likesLockAlertMsg || '🔒 Enlaces bloqueados: Faltan {faltan} likes en el Live (llevamos {llevamos}/{meta}) ❤️',
            profilePic: ''
          },
          chat: {
            type: 'chat',
            user: 'TesterChat',
            message: customText || '¡Hola! Este es un mensaje de prueba leído por el lector de chat.'
          }
        };
        const payload = payloads[type];
        if (payload) {
          iframe.contentWindow.postMessage({
            action: 'triggerTestAlert',
            payload: payload
          }, '*');
        }
      }
    }
    triggerSaveBadge(`🧪 Test [${type}] simulado en vivo`);
  };
  const triggerShareEvent = async () => {
    try {
      await fetch('/api/overlays/test/share', {
        method: 'POST'
      }).catch(() => {});
    } catch (e) {}
    triggerSaveBadge('📤 Share simulado');
  };
  const triggerGoalTest = async type => {
    const apiType = type === 'follows' ? 'follow' : type === 'coins' ? 'coin' : type === 'likes' ? 'like' : 'share';
    try {
      fetch('/api/goals/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: apiType
        })
      }).catch(() => {});
    } catch (e) {}

    // ¡Envío directo vía postMessage al iframe de meta local para prueba instantánea offline!
    const iframeId = `iframe-goals-${type}`;
    const iframe = document.getElementById(iframeId);
    const gConfig = goals[type] || {};
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        action: 'updateConfig',
        payload: {
          goalType: type,
          goalTarget: gConfig.goalTarget,
          goalLabel: gConfig.goalLabel,
          goalRewardText: gConfig.goalRewardText,
          primaryColor: gConfig.primaryColor,
          enabled: gConfig.enabled,
          goalsOpacity: gConfig.goalsOpacity,
          goalsRadius: gConfig.goalsRadius
        }
      }, '*');

      // Simular un incremento dinámico en la barra de progreso
      const mockProgress = Math.round(gConfig.goalTarget * (0.5 + Math.random() * 0.4));
      iframe.contentWindow.postMessage({
        action: 'triggerTestGoal',
        payload: {
          value: mockProgress
        }
      }, '*');
    }
    const typeLabels = {
      follows: 'Seguidores',
      likes: 'Likes',
      shares: 'Compartidos',
      coins: 'Monedas'
    };
    triggerSaveBadge(`🎯 Meta de ${typeLabels[type] || type} simulada`);
  };
  const triggerGoalsReset = async () => {
    if (!confirm('¿Resetear todos los contadores de meta? (No afecta a las estadísticas generales)')) return;
    try {
      await fetch('/api/goals/reset', {
        method: 'POST'
      });
      triggerSaveBadge('🔄 Contadores de meta reseteados');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Timer controllers
  const handleTimerAction = async (action, data = null) => {
    try {
      let url = `/api/timer/${action}`;
      let options = {
        method: 'POST'
      };
      if (data) {
        options.headers = {
          'Content-Type': 'application/json'
        };
        options.body = JSON.stringify(data);
      }
      await fetch(url, options);
      triggerSaveBadge(`⏱️ Acción [${action}] enviada`);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };
  const startActiveTimer = async () => {
    try {
      // Guardar primero, luego arrancar
      await fetch('/api/timer/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(timer)
      });
      await fetch('/api/timer/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          durationSeconds: (Number(timer.initialDuration) || 30) * 60
        })
      });
      triggerSaveBadge('⏱️ Timer iniciado/reiniciado');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Offline Testing sender
  const handleSendOfflineTest = async () => {
    setOfflineTest(prev => ({
      ...prev,
      resultText: 'Enviando...'
    }));
    try {
      const isManual = offlineTest.mode === 'manual';
      const payload = {
        user: offlineTest.user,
        message: isManual ? '' : offlineTest.message,
        appleMusicId: offlineTest.appleMusicId,
        songName: isManual ? offlineTest.song : '',
        artistName: isManual ? offlineTest.artist : '',
        sendToCider: offlineTest.sendToCider,
        sendToQueue: offlineTest.sendToQueue
      };
      const res = await fetch('/api/test/sr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setOfflineTest(prev => ({
          ...prev,
          resultText: `Error: ${data.error || 'Fallo de prueba'}`
        }));
        return;
      }
      const r = data.result || {};
      const lines = [];
      lines.push(`Resultado: ${r.ok ? 'Éxito' : 'Fallo'}`);
      if (r.track) {
        lines.push(`Canción: ${r.track.songName || ''} — ${r.track.artistName || ''}`);
      }
      lines.push(`Cider Conectado: ${r.ciderConnected ? 'Sí' : 'No'}`);
      lines.push(`Enviado a Cider: ${r.ciderSent ? 'Sí' : 'No'}`);
      lines.push(`Guardado en Cola: ${r.queueSaved ? 'Sí' : 'No'}`);
      setOfflineTest(prev => ({
        ...prev,
        resultText: lines.join('\n')
      }));
    } catch (e) {
      setOfflineTest(prev => ({
        ...prev,
        resultText: `Error: ${e.message}`
      }));
    }
  };

  // Mock Cider control actions
  const handleMockCiderAction = async (action, emit = false) => {
    setMockCider(prev => ({
      ...prev,
      resultText: 'Procesando...'
    }));
    try {
      let url = `/api/mockcider/${action}`;
      let options = {
        method: 'POST'
      };
      if (emit) {
        url = '/api/mockcider/emit';
        options.headers = {
          'Content-Type': 'application/json'
        };
        options.body = JSON.stringify({
          requester: mockCider.requester || offlineTest.user,
          artistName: mockCider.artist || offlineTest.artist,
          songName: mockCider.song || offlineTest.song,
          appleMusicId: mockCider.appleMusicId || offlineTest.appleMusicId
        });
      }
      const res = await fetch(url, options);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMockCider(prev => ({
          ...prev,
          resultText: `Error: ${data.error || 'Error de Mock'}`
        }));
        return;
      }
      if (action === 'start') {
        setMockCider(prev => ({
          ...prev,
          resultText: `Mock Cider activo en puerto ${data.port}`
        }));
      } else if (action === 'stop') {
        setMockCider(prev => ({
          ...prev,
          resultText: 'Mock Cider detenido'
        }));
      } else if (action === 'clear') {
        setMockCider(prev => ({
          ...prev,
          resultText: 'Cola de Cider Mock limpia'
        }));
      } else if (action === 'play-next') {
        const p = data.played || {};
        setMockCider(prev => ({
          ...prev,
          resultText: `Reproduciendo next:\n${p.name || ''} — ${p.artistName || ''}\nPedida por: ${p.requester || 'N/A'}`
        }));
      } else if (emit) {
        setMockCider(prev => ({
          ...prev,
          resultText: `Now Playing Emitido:\n${mockCider.song} — ${mockCider.artist}`
        }));
      }
    } catch (e) {
      setMockCider(prev => ({
        ...prev,
        resultText: `Error: ${e.message}`
      }));
    }
  };
  const handleSendGiftTest = async () => {
    setGiftTest(prev => ({
      ...prev,
      resultText: 'Enviando regalo de prueba...'
    }));
    try {
      const res = await fetch('/api/timer/test/gift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: giftTest.user,
          giftName: giftTest.giftName,
          coins: parseInt(giftTest.coins) || 1,
          seconds: giftTest.seconds ? parseInt(giftTest.seconds) : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        let msg = `✅ ¡Regalo de prueba enviado!\n`;
        if (data.extended) {
          msg += `Timer extendido con éxito +${data.extendedSeconds}s.`;
        } else {
          msg += `Alerta enviada. (El timer no se extendió porque no está iniciado/corriendo).`;
        }
        setGiftTest(prev => ({
          ...prev,
          resultText: msg
        }));
        triggerSaveBadge('🎁 Regalo simulado');
      } else {
        setGiftTest(prev => ({
          ...prev,
          resultText: `Error: ${data.error || 'Desconocido'}`
        }));
      }
    } catch (e) {
      setGiftTest(prev => ({
        ...prev,
        resultText: `Error: ${e.message}`
      }));
    }
  };

  // Lucide Icon parser helper for react
  const renderIcon = (name, size = 18, color = "currentColor") => {
    return /*#__PURE__*/React.createElement("i", {
      "data-lucide": name,
      style: {
        width: size,
        height: size,
        display: 'inline-block',
        verticalAlign: 'middle'
      }
    });
  };
  React.useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });
  const isConfigDirty = React.useMemo(() => {
    if (!initialConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(initialConfig);
  }, [config, initialConfig]);

  // Advanced Chat TTS helper functions
  const addSpecialUser = () => {
    const name = newSpecialUser.username.trim().replace(/^@/, '');
    if (!name) return;
    const currentList = overlays.chatTtsSpecialUsers || [];
    const exists = currentList.some(u => u.username.toLowerCase() === name.toLowerCase());
    if (exists) return;
    const updatedList = [...currentList, {
      username: name,
      allowed: true,
      voice: 'Default Voice',
      speed: 50,
      pitch: 50
    }];
    setOverlays({
      ...overlays,
      chatTtsSpecialUsers: updatedList
    });
    setNewSpecialUser({
      username: '',
      allowed: true,
      voice: 'Default Voice',
      speed: 50,
      pitch: 50
    });
  };
  const deleteSpecialUser = username => {
    const currentList = overlays.chatTtsSpecialUsers || [];
    const updatedList = currentList.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    setOverlays({
      ...overlays,
      chatTtsSpecialUsers: updatedList
    });
  };
  const updateSpecialUser = (username, key, value) => {
    const currentList = overlays.chatTtsSpecialUsers || [];
    const updatedList = currentList.map(u => {
      if (u.username.toLowerCase() === username.toLowerCase()) {
        return {
          ...u,
          [key]: value
        };
      }
      return u;
    });
    setOverlays({
      ...overlays,
      chatTtsSpecialUsers: updatedList
    });
  };
  const showSaveBar = isConfigDirty || Object.keys(dirtyKeys).length > 0 || !!saveStatus;
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      marginBottom: '30px'
    }
  }, /*#__PURE__*/React.createElement("h1", null, "\uD83C\uDF9B\uFE0F Zero FM Bot Control"), /*#__PURE__*/React.createElement("div", {
    className: "subtitle"
  }, "Configura tu bot de pedidos e interact\xFAa con overlays premium en tiempo real"), /*#__PURE__*/React.createElement("div", {
    className: "status-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: `badge ${status.ciderConnected ? 'active' : 'inactive'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "badge-dot"
  }), /*#__PURE__*/React.createElement("span", null, "Cider: ", status.ciderConnected ? 'Conectado' : 'Desconectado')), /*#__PURE__*/React.createElement("div", {
    className: `badge ${status.tiktokState === 'connected' ? 'active' : status.isConnecting || status.isRetrying ? 'pending' : 'inactive'}`,
    style: {
      paddingRight: '6px',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '2px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "badge-dot"
  }), /*#__PURE__*/React.createElement("span", null, "TikTok: ", status.isConnecting ? 'Conectando...' : status.isRetrying ? 'Reintentando en 10s...' : status.tiktokState === 'connected' ? 'Conectado' : 'Inactivo'), /*#__PURE__*/React.createElement("button", {
    onClick: handleToggleTikTok,
    style: {
      background: status.tiktokState === 'connected' || status.isConnecting || status.isRetrying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
      border: `1px solid ${status.tiktokState === 'connected' || status.isConnecting || status.isRetrying ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
      borderRadius: '12px',
      color: status.tiktokState === 'connected' || status.isConnecting || status.isRetrying ? 'var(--error)' : 'var(--success)',
      cursor: 'pointer',
      padding: '3px 10px',
      fontSize: '0.75rem',
      fontWeight: '700',
      marginLeft: '4px',
      transition: 'all 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }
  }, status.tiktokState === 'connected' ? 'Desconectar' : status.isConnecting || status.isRetrying ? 'Cancelar' : 'Conectar')), status.lastConnectionError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      color: 'var(--error)',
      opacity: 0.85,
      maxWidth: '380px',
      wordBreak: 'break-word',
      marginLeft: '2px',
      paddingTop: '2px'
    }
  }, status.lastConnectionError)), /*#__PURE__*/React.createElement("div", {
    className: `badge ${status.mockCiderActive ? 'active' : 'inactive'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "badge-dot"
  }), /*#__PURE__*/React.createElement("span", null, "Mock Cider: ", status.mockCiderActive ? `Activo :${status.mockCiderPort}` : 'Inactivo')), /*#__PURE__*/React.createElement("div", {
    className: "badge"
  }, /*#__PURE__*/React.createElement("div", {
    className: "badge-dot",
    style: {
      background: '#7c3aed'
    }
  }), /*#__PURE__*/React.createElement("span", null, "Cola Cider: ", status.queueLength, " canciones")))), /*#__PURE__*/React.createElement("div", {
    className: "tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: `tab-btn ${activeTab === 'configuracion' ? 'active' : ''}`,
    onClick: () => setActiveTab('configuracion')
  }, renderIcon('settings'), " Configuraci\xF3n"), /*#__PURE__*/React.createElement("button", {
    className: `tab-btn ${activeTab === 'overlays' ? 'active' : ''}`,
    onClick: () => setActiveTab('overlays')
  }, renderIcon('tv'), " \uD83D\uDCFA Overlays"), /*#__PURE__*/React.createElement("button", {
    className: `tab-btn ${activeTab === 'prueba' ? 'active' : ''}`,
    onClick: () => setActiveTab('prueba')
  }, renderIcon('test-tube'), " \uD83E\uDDEA Pruebas")), activeTab === 'configuracion' && /*#__PURE__*/React.createElement("div", {
    className: "config-layout"
  }, /*#__PURE__*/React.createElement("div", {
    className: "config-sidebar"
  }, /*#__PURE__*/React.createElement("button", {
    className: `config-menu-item ${activeConfigSub === 'commands' ? 'active' : ''}`,
    onClick: () => setActiveConfigSub('commands')
  }, /*#__PURE__*/React.createElement("span", null, renderIcon('user'), " Conexi\xF3n & Bot")), /*#__PURE__*/React.createElement("button", {
    className: `config-menu-item ${activeConfigSub === 'permissions' ? 'active' : ''}`,
    onClick: () => setActiveConfigSub('permissions')
  }, /*#__PURE__*/React.createElement("span", null, renderIcon('shield'), " Permisos & VIP")), /*#__PURE__*/React.createElement("button", {
    className: `config-menu-item ${activeConfigSub === 'likes' ? 'active' : ''}`,
    onClick: () => setActiveConfigSub('likes')
  }, /*#__PURE__*/React.createElement("span", null, renderIcon('heart'), " Econom\xEDa de Likes")), /*#__PURE__*/React.createElement("button", {
    className: `config-menu-item ${activeConfigSub === 'system' ? 'active' : ''}`,
    onClick: () => setActiveConfigSub('system')
  }, /*#__PURE__*/React.createElement("span", null, renderIcon('power'), " Sistema & Servidor"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flexGrow: 1,
      minWidth: 0
    }
  }, activeConfigSub === 'commands' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '18px',
      fontSize: '1.2rem',
      fontWeight: '700'
    }
  }, "Acceso a TikTok"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, renderIcon('user'), " Usuario de TikTok (Live)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "@usuario",
    value: config.tiktokUsername,
    onChange: e => setConfig({
      ...config,
      tiktokUsername: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px',
      paddingTop: '15px',
      borderTop: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("label", null, renderIcon('key'), " Session ID (Cookie \"sessionid\" de TikTok)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Pegar cookie sessionid",
    value: config.sessionId || '',
    onChange: e => setConfig({
      ...config,
      sessionId: e.target.value
    })
  }), /*#__PURE__*/React.createElement("small", null, "Cookie ", /*#__PURE__*/React.createElement("code", null, "sessionid"), " de TikTok. Necesaria junto con ", /*#__PURE__*/React.createElement("strong", null, "tt-target-idc"), " para conexi\xF3n autenticada.")), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '14px'
    }
  }, /*#__PURE__*/React.createElement("label", null, renderIcon('globe'), " tt-target-idc (Regi\xF3n de tu cuenta TikTok)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Ej: us-eastx1, maliva-1, sg-alisg, etc.",
    value: config.ttTargetIdc || '',
    onChange: e => setConfig({
      ...config,
      ttTargetIdc: e.target.value
    })
  }), /*#__PURE__*/React.createElement("small", null, "Cookie ", /*#__PURE__*/React.createElement("code", null, "tt-target-idc"), " de TikTok (requerida junto con Session ID). \xA0", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      alert('⚠️ IMPORTANTE: La nueva versión requiere DOS cookies de TikTok:\n\n1. Abre TikTok en Chrome/Firefox\n2. Inicia sesión en tu cuenta\n3. Abre Herramientas de Desarrollador (F12)\n4. Ve a Application → Cookies → https://www.tiktok.com\n5. Busca y copia:\n   • "sessionid" → pegarlo en el campo Session ID\n   • "tt-target-idc" → pegarlo en el campo tt-target-idc\n\nEjemplos de tt-target-idc: us-eastx1, maliva-1, sg-alisg\n\n💡 Sin estas cookies el bot conecta en modo anónimo (funciona si estás en LIVE).');
    },
    style: {
      color: '#ff0050',
      fontWeight: 'bold'
    }
  }, "\xBFC\xF3mo obtenerlas?"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '14px',
      paddingTop: '15px',
      borderTop: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("label", null, renderIcon('shield'), " Euler Stream API Key (Opcional - Evita Bloqueos/Rate Limit)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Pegar API Key de Euler Stream",
    value: config.eulerApiKey || '',
    onChange: e => setConfig({
      ...config,
      eulerApiKey: e.target.value
    })
  }), /*#__PURE__*/React.createElement("small", null, "Si tienes problemas de conexi\xF3n (error \"Too many connections started\"), puedes crear una cuenta gratis en ", /*#__PURE__*/React.createElement("a", {
    href: "https://www.eulerstream.com/",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: '#ff0050',
      textDecoration: 'underline'
    }
  }, "eulerstream.com"), ", obtener una API Key y pegarla aqu\xED para evitar el l\xEDmite por hora.")), /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: '35px',
      marginBottom: '18px',
      fontSize: '1.2rem',
      fontWeight: '700',
      paddingTop: '20px',
      borderTop: '1px solid rgba(255,255,255,0.1)'
    }
  }, "Comandos & Comportamiento"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, renderIcon('message-square'), " Comando de Pedido (Separados por coma)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "!sr, !pedir, !cancion",
    value: config.commandAliases.join(', '),
    onChange: e => setConfig({
      ...config,
      commandAliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
    })
  }), /*#__PURE__*/React.createElement("small", null, "Los comandos que usar\xE1n los espectadores en el chat (ej. !sr, !pedir).")), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px',
      paddingTop: '15px',
      borderTop: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("label", null, renderIcon('eye-off'), " Ejemplo a Ignorar en B\xFAsqueda"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "artista cancion",
    value: config.ignoreExampleQuery,
    onChange: e => setConfig({
      ...config,
      ignoreExampleQuery: e.target.value
    })
  }), /*#__PURE__*/React.createElement("small", null, "Si alg\xFAn usuario escribe exactamente ", /*#__PURE__*/React.createElement("code", null, "!sr artista cancion"), ", el bot omitir\xE1 procesar el pedido.")), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      marginTop: '20px',
      paddingTop: '15px',
      borderTop: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-label"
  }, /*#__PURE__*/React.createElement("span", null, "Habilitar comando Puntos (!puntos)"), /*#__PURE__*/React.createElement("small", null, "Permite a los usuarios consultar sus puntos acumulados en el chat de TikTok.")), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: config.allowPointsCommand,
    onChange: e => setConfig({
      ...config,
      allowPointsCommand: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), activeConfigSub === 'permissions' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '18px',
      fontSize: '1.2rem',
      fontWeight: '700'
    }
  }, "Permisos & Acceso VIP"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-label"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDD12 Modo Estricto (Solo Donadores/VIP)"), /*#__PURE__*/React.createElement("small", null, "Si est\xE1 activo, solo usuarios VIP o donadores de monedas podr\xE1n pedir canciones.")), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: config.requireVipForSr,
    onChange: e => setConfig({
      ...config,
      requireVipForSr: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, renderIcon('coins'), " Monedas m\xEDnimas para VIP de sesi\xF3n"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: config.minCoinsForVip,
    onChange: e => setConfig({
      ...config,
      minCoinsForVip: parseInt(e.target.value) || 0
    })
  }), /*#__PURE__*/React.createElement("small", null, "Cualquier regalo acumulado con este valor otorgar\xE1 permisos de Song Request VIP al usuario por todo el stream.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '25px',
      paddingTop: '15px',
      borderTop: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      fontSize: '0.95rem',
      color: 'white',
      fontWeight: '700'
    }
  }, "Excepciones de Permiso (Siempre permitidos a pedir)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-label"
  }, /*#__PURE__*/React.createElement("span", null, "Permitir Suscriptores"), /*#__PURE__*/React.createElement("small", null, "Los suscriptores de pago siempre pueden pedir canciones.")), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: config.allowSubscribers,
    onChange: e => setConfig({
      ...config,
      allowSubscribers: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-label"
  }, /*#__PURE__*/React.createElement("span", null, "Permitir Moderadores"), /*#__PURE__*/React.createElement("small", null, "Tus moderadores del Live siempre pueden pedir canciones.")), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: config.allowModerators,
    onChange: e => setConfig({
      ...config,
      allowModerators: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-label"
  }, /*#__PURE__*/React.createElement("span", null, "Permitir Super Fans (Nivel > 0)"), /*#__PURE__*/React.createElement("small", null, "Los espectadores con insignia de Fan activo pueden pedir.")), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: config.allowSuperFans,
    onChange: e => setConfig({
      ...config,
      allowSuperFans: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))))), activeConfigSub === 'likes' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '18px',
      fontSize: '1.2rem',
      fontWeight: '700'
    }
  }, "Econom\xEDa de Likes \u2764\uFE0F"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Recompensa a los usuarios que apoyan tu Live dando likes con puntos autom\xE1ticos para pedir canciones."), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, renderIcon('heart'), " Likes requeridos para ganar 1 Punto"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: config.likesPerPoint,
    onChange: e => setConfig({
      ...config,
      likesPerPoint: parseInt(e.target.value) || 120
    })
  }), /*#__PURE__*/React.createElement("small", null, "Si se define en 120 likes, enviar 600 likes otorgar\xE1 5 puntos de pedido al espectador."))), activeConfigSub === 'system' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '18px',
      fontSize: '1.2rem',
      fontWeight: '700'
    }
  }, "Control del Servidor del Bot \uD83D\uDDA5\uFE0F"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Administraci\xF3n del sistema Node.js ejecut\xE1ndose localmente en tu PC."), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px',
      background: 'rgba(239, 68, 68, 0.05)',
      border: '1px solid rgba(239, 68, 68, 0.15)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--error)',
      marginTop: 0,
      marginBottom: '8px',
      fontSize: '0.95rem',
      fontWeight: '700'
    }
  }, "\u26A0\uFE0F Apagar Servidor"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.82rem',
      marginBottom: '15px',
      lineHeight: 1.4
    }
  }, "Detiene el programa por completo. Deber\xE1s volver a ejecutar el archivo de inicio (EJECUTAR_SILENCIOSO.vbs o INICIAR_BOT.bat) en tu PC de streaming para encenderlo de nuevo."), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: handleShutdownServer,
    style: {
      background: 'rgba(239, 68, 68, 0.15)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      color: 'var(--error)',
      fontWeight: 'bold',
      padding: '10px 18px',
      cursor: 'pointer',
      borderRadius: '6px',
      transition: 'all 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    }
  }, renderIcon('power'), " Apagar Servidor del Bot"))))), activeTab === 'overlays' && /*#__PURE__*/React.createElement("div", {
    className: "overlays-layout"
  }, /*#__PURE__*/React.createElement("div", {
    className: "overlays-sidebar"
  }, /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'player' ? 'active' : ''}`,
    onClick: () => setActiveSub('player')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCBF Reproductor"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge"
  }, "Activo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'queue' ? 'active' : ''}`,
    onClick: () => setActiveSub('queue')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCCB Cola de Espera"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge"
  }, "Activo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'roulette' ? 'active' : ''}`,
    onClick: () => setActiveSub('roulette')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83C\uDFA1 Ruleta Zero"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge"
  }, "Activo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'alerts' ? 'active' : ''}`,
    onClick: () => setActiveSub('alerts')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDD14 Alertas Premium"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge"
  }, "Activo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'topgifters' ? 'active' : ''}`,
    onClick: () => setActiveSub('topgifters')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83C\uDFC6 Top Ranking"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge"
  }, "Activo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'toplikers' ? 'active' : ''}`,
    onClick: () => setActiveSub('toplikers')
  }, /*#__PURE__*/React.createElement("span", null, "\u2764\uFE0F Top Likers"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge",
    style: {
      color: '#06b6d4'
    }
  }, "Nuevo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'likeslock' ? 'active' : ''}`,
    onClick: () => setActiveSub('likeslock')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDD12 Candado de Links"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge"
  }, "Activo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'ticker' ? 'active' : ''}`,
    onClick: () => setActiveSub('ticker')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCC8 Stats Scrolling"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge"
  }, "Activo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'goals' ? 'active' : ''}`,
    onClick: () => setActiveSub('goals')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83C\uDFAF Metas (Goals)"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge",
    style: {
      color: '#06b6d4'
    }
  }, "Nuevo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'timer' ? 'active' : ''}`,
    onClick: () => setActiveSub('timer')
  }, /*#__PURE__*/React.createElement("span", null, "\u23F1\uFE0F Timer Countdown"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge",
    style: {
      color: '#06b6d4'
    }
  }, "Nuevo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'lastevents' ? 'active' : ''}`,
    onClick: () => setActiveSub('lastevents')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCCB \xDAltimos Eventos"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge",
    style: {
      color: '#06b6d4'
    }
  }, "Nuevo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'welcome' ? 'active' : ''}`,
    onClick: () => setActiveSub('welcome')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDC4B Alerta Bienvenida"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge",
    style: {
      color: '#06b6d4'
    }
  }, "Nuevo")), /*#__PURE__*/React.createElement("button", {
    className: `overlays-menu-item ${activeSub === 'tts' ? 'active' : ''}`,
    onClick: () => setActiveSub('tts')
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDDE3\uFE0F Lector de Voz (TTS)"), /*#__PURE__*/React.createElement("span", {
    className: "menu-badge",
    style: {
      color: '#06b6d4'
    }
  }, "Nuevo"))), /*#__PURE__*/React.createElement("div", {
    className: "overlays-content"
  }, activeSub === 'player' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83D\uDCBF Reproductor de Canci\xF3n Actual (Main Overlay)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Muestra la canci\xF3n actual reproduci\xE9ndose en Cider/Apple Music con car\xE1tula de alta resoluci\xF3n y barra de progreso."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '20px',
      paddingBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad del Fondo: ", Math.round(overlays.playerOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.playerOpacity,
    onChange: e => setOverlays({
      ...overlays,
      playerOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado de Bordes: ", overlays.playerRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.playerRadius,
    onChange: e => setOverlays({
      ...overlays,
      playerRadius: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o de Letra: ", overlays.playerFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.playerFontSize,
    onChange: e => setOverlays({
      ...overlays,
      playerFontSize: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Acento Barra"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.playerColor,
    onChange: e => setOverlays({
      ...overlays,
      playerColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      cursor: 'pointer',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.playerShowCardBg !== false,
    onChange: e => setOverlays({
      ...overlays,
      playerShowCardBg: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Mostrar Tarjeta (Fondo)")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.02)',
      padding: '15px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.05)',
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("h5", {
    style: {
      marginBottom: '12px',
      color: '#ff0050',
      fontWeight: 'bold'
    }
  }, "Contorno / Borde"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor del Contorno: ", overlays.playerBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.playerBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      playerBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo de Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.playerBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      playerBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.playerBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      playerBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad de Contorno: ", overlays.playerBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.playerBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      playerBorderOpacity: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.playerShowAccentBorder !== false,
    onChange: e => setOverlays({
      ...overlays,
      playerShowAccentBorder: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Borde de Acento Izquierdo")), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor Acento: ", overlays.playerAccentBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "20",
    step: "1",
    value: overlays.playerAccentBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      playerAccentBorderWidth: parseInt(e.target.value)
    }),
    disabled: overlays.playerShowAccentBorder === false
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.02)',
      padding: '15px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.05)',
      marginTop: '15px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h5", {
    style: {
      marginBottom: '12px',
      color: '#ff0050',
      fontWeight: 'bold'
    }
  }, "Sombra de Tarjeta"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      alignSelf: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.playerShowShadow !== false,
    onChange: e => setOverlays({
      ...overlays,
      playerShowShadow: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Activar Sombra")), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Sombra"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.playerShadowColor || '#000000',
    onChange: e => setOverlays({
      ...overlays,
      playerShadowColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    },
    disabled: overlays.playerShowShadow === false
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Desenfoque (Blur): ", overlays.playerShadowBlur || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.playerShadowBlur || 0,
    onChange: e => setOverlays({
      ...overlays,
      playerShadowBlur: parseInt(e.target.value)
    }),
    disabled: overlays.playerShowShadow === false
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad de Sombra: ", overlays.playerShadowOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.playerShadowOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      playerShadowOpacity: parseInt(e.target.value)
    }),
    disabled: overlays.playerShowShadow === false
  })))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Player'),
    style: {
      marginTop: '10px'
    }
  }, renderIcon('save'), " Guardar Dise\xF1o")), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live Player")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-player",
    src: "./overlay.html",
    className: "preview-iframe",
    style: {
      height: '380px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 450 \xD7 120 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/overlay.html`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/overlay.html`)
  }, "Copiar URL")))), activeSub === 'queue' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83D\uDCCB Lista de Espera / Cola (Queue Overlay)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Muestra la cola de solicitudes hechas por tus espectadores con estimaciones de tiempo."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '20px',
      paddingBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "grid-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(overlays.queueOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.queueOpacity,
    onChange: e => setOverlays({
      ...overlays,
      queueOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", overlays.queueRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.queueRadius,
    onChange: e => setOverlays({
      ...overlays,
      queueRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Letra: ", overlays.queueFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.queueFontSize,
    onChange: e => setOverlays({
      ...overlays,
      queueFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.queueShowCardBg !== false,
    onChange: e => setOverlays({
      ...overlays,
      queueShowCardBg: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Mostrar Tarjeta (Fondo)")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.02)',
      padding: '15px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.05)',
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("h5", {
    style: {
      marginBottom: '12px',
      color: '#00e5ff',
      fontWeight: 'bold'
    }
  }, "Contorno / Borde"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor del Contorno: ", overlays.queueBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.queueBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      queueBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo de Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.queueBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      queueBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.queueBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      queueBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad de Contorno: ", overlays.queueBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.queueBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      queueBorderOpacity: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.queueShowAccentBorder !== false,
    onChange: e => setOverlays({
      ...overlays,
      queueShowAccentBorder: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Borde de Acento Izquierdo")), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor Acento: ", overlays.queueAccentBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "20",
    step: "1",
    value: overlays.queueAccentBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      queueAccentBorderWidth: parseInt(e.target.value)
    }),
    disabled: overlays.queueShowAccentBorder === false
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.queueShowSweepBorder !== false,
    onChange: e => setOverlays({
      ...overlays,
      queueShowSweepBorder: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Borde de Barrido Animado (Sweep)")))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.02)',
      padding: '15px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.05)',
      marginTop: '15px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h5", {
    style: {
      marginBottom: '12px',
      color: '#00e5ff',
      fontWeight: 'bold'
    }
  }, "Sombra de Tarjeta"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      alignSelf: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.queueShowShadow !== false,
    onChange: e => setOverlays({
      ...overlays,
      queueShowShadow: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Activar Sombra")), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Sombra"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.queueShadowColor || '#000000',
    onChange: e => setOverlays({
      ...overlays,
      queueShadowColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    },
    disabled: overlays.queueShowShadow === false
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Desenfoque (Blur): ", overlays.queueShadowBlur || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.queueShadowBlur || 0,
    onChange: e => setOverlays({
      ...overlays,
      queueShadowBlur: parseInt(e.target.value)
    }),
    disabled: overlays.queueShowShadow === false
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad de Sombra: ", overlays.queueShadowOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.queueShadowOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      queueShadowOpacity: parseInt(e.target.value)
    }),
    disabled: overlays.queueShowShadow === false
  })))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Queue'),
    style: {
      marginTop: '10px'
    }
  }, renderIcon('save'), " Guardar Dise\xF1o")), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live Queue")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-queue",
    src: "./queue_overlay.html",
    className: "preview-iframe",
    style: {
      height: '420px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 380 \xD7 600 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/queue_overlay.html`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/queue_overlay.html`)
  }, "Copiar URL")))), activeSub === 'roulette' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83C\uDFA1 Ruleta de la Fortuna (Roulette Overlay)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Ruleta interactiva animada de alta fidelidad para sorteos e interacciones directas en tu live."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '25px',
      padding: '15px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      color: '#eab308'
    }
  }, "\u26A1 Estado de la Ruleta"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.82rem',
      color: 'var(--text-secondary)'
    }
  }, "Activa o desactiva la visualizaci\xF3n de la ruleta en el overlay de tu stream.")), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      borderBottom: 'none',
      padding: 0,
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.rouletteOverlayEnabled !== false,
    onChange: async e => {
      const val = e.target.checked;
      const next = {
        ...overlays,
        rouletteOverlayEnabled: val
      };
      setDirtyKeys(d => ({
        ...d,
        rouletteOverlayEnabled: true
      }));
      setOverlays(next);
      localStorage.setItem('offline_overlays_config', JSON.stringify(next));
      saveOverlaysConfig(next, {
        rouletteOverlayEnabled: true
      }).catch(() => {});
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '20px',
      paddingBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad del Fondo: ", Math.round(overlays.rouletteOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.rouletteOpacity,
    onChange: e => setOverlays({
      ...overlays,
      rouletteOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado de Bordes: ", overlays.rouletteRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.rouletteRadius,
    onChange: e => setOverlays({
      ...overlays,
      rouletteRadius: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '15px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.rouletteShowCardBg !== false,
    onChange: e => setOverlays({
      ...overlays,
      rouletteShowCardBg: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Mostrar Tarjeta Ganador")), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.rouletteShowShadow !== false,
    onChange: e => setOverlays({
      ...overlays,
      rouletteShowShadow: e.target.checked
    }),
    style: {
      width: 'auto',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      cursor: 'pointer',
      margin: 0
    }
  }, "Sombra del Ganador"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.02)',
      padding: '15px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.05)',
      marginTop: '15px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h5", {
    style: {
      marginBottom: '12px',
      color: '#eab308',
      fontWeight: 'bold'
    }
  }, "Contorno de Tarjeta Ganador"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor del Contorno: ", overlays.rouletteBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.rouletteBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      rouletteBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo de Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.rouletteBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      rouletteBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.rouletteBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      rouletteBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad de Contorno: ", overlays.rouletteBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.rouletteBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      rouletteBorderOpacity: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Ruleta'),
    style: {
      marginTop: '10px'
    }
  }, renderIcon('save'), " Guardar Dise\xF1o")), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live Roulette")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-roulette",
    src: "./roulette_overlay.html",
    className: "preview-iframe",
    style: {
      height: '480px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 800 \xD7 800 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/roulette_overlay.html`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/roulette_overlay.html`)
  }, "Copiar URL")))), activeSub === 'alerts' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '30px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      padding: '20px',
      borderLeft: '4px solid #a855f7'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '5px'
    }
  }, "\uD83D\uDD14 Centro de Configuraci\xF3n de Alertas Premium"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem'
    }
  }, "Personaliza de manera independiente cada evento de interacci\xF3n en tu stream de TikTok. Cada alerta cuenta con su propio dise\xF1o, efectos y enlace individual para OBS. Si prefieres unificar todo en un solo elemento, puedes usar el enlace general: ", /*#__PURE__*/React.createElement("code", {
    style: {
      color: '#c084fc',
      background: 'rgba(255,255,255,0.06)',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '0.82rem'
    }
  }, currentOrigin, "/alerts_overlay.html"))), /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      borderLeft: '4px solid #ec4899'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      color: '#ec4899',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }
  }, "\uD83D\uDC64 Alerta de Nuevos Seguidores"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-secondary)'
    }
  }, "Se activa cuando alguien te sigue en tiempo real.")), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      borderBottom: 'none',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.enableFollowAlert,
    onChange: e => setOverlays({
      ...overlays,
      enableFollowAlert: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), overlays.enableFollowAlert && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "preview-panel",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa (Seguidores)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-alerts-follow",
    src: "./alerts_overlay.html?type=follow",
    className: "preview-iframe",
    style: {
      height: '480px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 480 \xD7 550 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row",
    style: {
      display: 'flex',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/alerts_overlay.html?type=follow`,
    onClick: e => e.target.select(),
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/alerts_overlay.html?type=follow`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => triggerOverlayTest('follow'),
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#ec4899',
      borderColor: '#ec4899'
    }
  }, "\uD83E\uDDEA Probar Alerta"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      setShowFollowPersonalize(true);
      triggerOverlayTest('follow');
    },
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#a855f7',
      borderColor: '#a855f7'
    }
  }, "\u2699\uFE0F Personalizar Alerta"))), showFollowPersonalize && /*#__PURE__*/React.createElement("div", {
    className: "draggable-personalize-modal",
    style: {
      left: `${followModalPos.x}px`,
      top: `${followModalPos.y}px`
    },
    onMouseDown: handleMouseDownFollowModal
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-drag-handle follow-drag-handle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-title"
  }, "\uD83D\uDC64 Configuraci\xF3n de Alerta de Seguidores"), /*#__PURE__*/React.createElement("button", {
    className: "btn-close-modal",
    onClick: () => setShowFollowPersonalize(false)
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(overlays.followOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.followOpacity,
    onChange: e => setOverlays({
      ...overlays,
      followOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", overlays.followRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.followRadius,
    onChange: e => setOverlays({
      ...overlays,
      followRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o Letra: ", overlays.followFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.followFontSize,
    onChange: e => setOverlays({
      ...overlays,
      followFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2728 Ajustes de Contenedor y Tipograf\xEDa"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Fondo de Cristal (Tarjeta)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Fondo"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.followShowCard,
    onChange: e => setOverlays({
      ...overlays,
      followShowCard: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.01)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.04)',
      marginTop: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#a855f7',
      fontSize: '0.85rem'
    }
  }, "Personalizar Contorno (Borde)"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor Contorno: ", overlays.followBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.followBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      followBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.followBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      followBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.followBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      followBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Contorno: ", overlays.followBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.followBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      followBorderOpacity: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Familia de Fuente"), /*#__PURE__*/React.createElement("select", {
    value: overlays.followFontFamily,
    onChange: e => setOverlays({
      ...overlays,
      followFontFamily: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "Outfit"
  }, "Outfit (Moderna)"), /*#__PURE__*/React.createElement("option", {
    value: "Inter"
  }, "Inter (Limpia)"), /*#__PURE__*/React.createElement("option", {
    value: "Rubik"
  }, "Rubik (Geom\xE9trica)"), /*#__PURE__*/React.createElement("option", {
    value: "Montserrat"
  }, "Montserrat (Robusta)"), /*#__PURE__*/React.createElement("option", {
    value: "Poppins"
  }, "Poppins (Redondeada)"), /*#__PURE__*/React.createElement("option", {
    value: "Cinzel"
  }, "Cinzel (Elegante G\xF3tica)"), /*#__PURE__*/React.createElement("option", {
    value: "Fredoka"
  }, "Fredoka (Divertida Curva)"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Sombras y Contorno de Texto"), /*#__PURE__*/React.createElement("select", {
    value: overlays.followTextShadow,
    onChange: e => setOverlays({
      ...overlays,
      followTextShadow: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno (Plano)"), /*#__PURE__*/React.createElement("option", {
    value: "subtle"
  }, "Sutil (Sombra Suave)"), /*#__PURE__*/React.createElement("option", {
    value: "3d-retro"
  }, "3D Retro (Efecto Cl\xE1sico)"), /*#__PURE__*/React.createElement("option", {
    value: "neon-glow"
  }, "Brillo de Ne\xF3n (Resplandor)"), /*#__PURE__*/React.createElement("option", {
    value: "thick-stroke"
  }, "Delineado Grueso (Outline)")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83D\uDCAC Contenido de Alerta"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Mensaje (", `{user}`, ")"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: overlays.followsAlertMsg,
    onChange: e => setOverlays({
      ...overlays,
      followsAlertMsg: e.target.value
    }),
    placeholder: "\xA1gracias por seguir el canal! \uD83D\uDC64"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2699\uFE0F Efectos Habilitados"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Texto Gradiente Animado (Arco\xEDris)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.followRainbowText,
    onChange: e => setOverlays({
      ...overlays,
      followRainbowText: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efecto Rebote 3D de Letras"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.followBounceText,
    onChange: e => setOverlays({
      ...overlays,
      followBounceText: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Animaciones Lottie Premium"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.followShowLottie,
    onChange: e => setOverlays({
      ...overlays,
      followShowLottie: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efectos de Sonido en Alerta"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.followPlayAudio,
    onChange: e => setOverlays({
      ...overlays,
      followPlayAudio: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), overlays.followPlayAudio && /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      paddingLeft: '15px',
      marginTop: '5px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Volumen del Sonido: ", overlays.followAudioVolume !== undefined ? overlays.followAudioVolume : 50, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.followAudioVolume !== undefined ? overlays.followAudioVolume : 50,
    onChange: e => setOverlays({
      ...overlays,
      followAudioVolume: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Lector de Voz (TTS Espa\xF1ol)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.followTtsEnabled,
    onChange: e => setOverlays({
      ...overlays,
      followTtsEnabled: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      handleSaveOverlaysConfigOnly('Seguidores');
      setShowFollowPersonalize(false);
    },
    style: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Configuraci\xF3n de Seguidores"))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Seguidores'),
    style: {
      marginTop: '15px',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Configuraci\xF3n de Seguidores")), /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      borderLeft: '4px solid #ef4444'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      color: '#ef4444',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }
  }, "\u2764\uFE0F Alerta de Tormenta de Likes"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-secondary)'
    }
  }, "Se activa al acumular una cantidad establecida de likes en tu live.")), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      borderBottom: 'none',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.enableLikeAlert,
    onChange: e => setOverlays({
      ...overlays,
      enableLikeAlert: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), overlays.enableLikeAlert && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "preview-panel",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa (Likes)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-alerts-like",
    src: "./alerts_overlay.html?type=like",
    className: "preview-iframe",
    style: {
      height: '480px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 480 \xD7 550 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row",
    style: {
      display: 'flex',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/alerts_overlay.html?type=like`,
    onClick: e => e.target.select(),
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/alerts_overlay.html?type=like`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => triggerOverlayTest('like'),
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#ef4444',
      borderColor: '#ef4444'
    }
  }, "\uD83E\uDDEA Probar Alerta"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      setShowLikesPersonalize(true);
      triggerOverlayTest('like');
    },
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#a855f7',
      borderColor: '#a855f7'
    }
  }, "\u2699\uFE0F Personalizar Alerta"))), showLikesPersonalize && /*#__PURE__*/React.createElement("div", {
    className: "draggable-personalize-modal",
    style: {
      left: `${likesModalPos.x}px`,
      top: `${likesModalPos.y}px`
    },
    onMouseDown: handleMouseDownLikesModal
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-drag-handle likes-drag-handle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-title"
  }, "\u2764\uFE0F Configuraci\xF3n de Alerta de Likes"), /*#__PURE__*/React.createElement("button", {
    className: "btn-close-modal",
    onClick: () => setShowLikesPersonalize(false)
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(overlays.likeOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.likeOpacity,
    onChange: e => setOverlays({
      ...overlays,
      likeOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", overlays.likeRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.likeRadius,
    onChange: e => setOverlays({
      ...overlays,
      likeRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o Letra Base: ", overlays.likeFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.likeFontSize,
    onChange: e => setOverlays({
      ...overlays,
      likeFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83D\uDCD0 Dimensiones y Tama\xF1os (Estilo Tikfinity)"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o del Coraz\xF3n: ", overlays.likeHeartSize || 190, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "100",
    max: "300",
    step: "5",
    value: overlays.likeHeartSize || 190,
    onChange: e => setOverlays({
      ...overlays,
      likeHeartSize: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o Letra Usuario: ", overlays.likeUsernameSize || 35, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "16",
    max: "60",
    step: "1",
    value: overlays.likeUsernameSize || 35,
    onChange: e => setOverlays({
      ...overlays,
      likeUsernameSize: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o Letra Mensaje: ", overlays.likeMessageSize || 20, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "12",
    max: "36",
    step: "1",
    value: overlays.likeMessageSize || 20,
    onChange: e => setOverlays({
      ...overlays,
      likeMessageSize: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Alto del Contenedor (Overlay): ", overlays.likeWrapperHeight || 290, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "200",
    max: "450",
    step: "10",
    value: overlays.likeWrapperHeight || 290,
    onChange: e => setOverlays({
      ...overlays,
      likeWrapperHeight: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2728 Ajustes de Contenedor y Tipograf\xEDa"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Fondo de Cristal (Tarjeta)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Fondo"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.likeShowCard,
    onChange: e => setOverlays({
      ...overlays,
      likeShowCard: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.01)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.04)',
      marginTop: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#a855f7',
      fontSize: '0.85rem'
    }
  }, "Personalizar Contorno (Borde)"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor Contorno: ", overlays.likeBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.likeBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      likeBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.likeBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      likeBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.likeBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      likeBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Contorno: ", overlays.likeBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.likeBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      likeBorderOpacity: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Familia de Fuente"), /*#__PURE__*/React.createElement("select", {
    value: overlays.likeFontFamily,
    onChange: e => setOverlays({
      ...overlays,
      likeFontFamily: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "Outfit"
  }, "Outfit (Moderna)"), /*#__PURE__*/React.createElement("option", {
    value: "Inter"
  }, "Inter (Limpia)"), /*#__PURE__*/React.createElement("option", {
    value: "Rubik"
  }, "Rubik (Geom\xE9trica)"), /*#__PURE__*/React.createElement("option", {
    value: "Montserrat"
  }, "Montserrat (Robusta)"), /*#__PURE__*/React.createElement("option", {
    value: "Poppins"
  }, "Poppins (Redondeada)"), /*#__PURE__*/React.createElement("option", {
    value: "Cinzel"
  }, "Cinzel (Elegante G\xF3tica)"), /*#__PURE__*/React.createElement("option", {
    value: "Fredoka"
  }, "Fredoka (Divertida Curva)"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Sombras y Contorno de Texto"), /*#__PURE__*/React.createElement("select", {
    value: overlays.likeTextShadow,
    onChange: e => setOverlays({
      ...overlays,
      likeTextShadow: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno (Plano)"), /*#__PURE__*/React.createElement("option", {
    value: "subtle"
  }, "Sutil (Sombra Suave)"), /*#__PURE__*/React.createElement("option", {
    value: "3d-retro"
  }, "3D Retro (Efecto Cl\xE1sico)"), /*#__PURE__*/React.createElement("option", {
    value: "neon-glow"
  }, "Brillo de Ne\xF3n (Resplandor)"), /*#__PURE__*/React.createElement("option", {
    value: "thick-stroke"
  }, "Delineado Grueso (Outline)")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83D\uDCAC Contenido de Alerta"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Mensaje \u2014 Variables: ", /*#__PURE__*/React.createElement("code", {
    style: {
      color: '#f87171'
    }
  }, `{user}`), " nombre, ", /*#__PURE__*/React.createElement("code", {
    style: {
      color: '#f87171'
    }
  }, `{likes}`), " batch, ", /*#__PURE__*/React.createElement("code", {
    style: {
      color: '#f87171'
    }
  }, `{total}`), " acumulado sesi\xF3n"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: overlays.likesAlertMsg,
    onChange: e => setOverlays({
      ...overlays,
      likesAlertMsg: e.target.value
    }),
    placeholder: "\xA1Ya lleva {total} likes esta noche! \u2764\uFE0F"
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Likes M\xEDnimos para Alerta"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: overlays.minLikesAlert,
    onChange: e => setOverlays({
      ...overlays,
      minLikesAlert: parseInt(e.target.value) || 100
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2699\uFE0F Efectos Habilitados"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Texto Gradiente Animado (Arco\xEDris)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.likeRainbowText,
    onChange: e => setOverlays({
      ...overlays,
      likeRainbowText: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efecto Rebote 3D de Letras"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.likeBounceText,
    onChange: e => setOverlays({
      ...overlays,
      likeBounceText: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Animaciones Lottie Premium"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.likeShowLottie,
    onChange: e => setOverlays({
      ...overlays,
      likeShowLottie: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efectos de Sonido en Alerta"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.likePlayAudio,
    onChange: e => setOverlays({
      ...overlays,
      likePlayAudio: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), overlays.likePlayAudio && /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      paddingLeft: '15px',
      marginTop: '5px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Volumen del Sonido: ", overlays.likeAudioVolume !== undefined ? overlays.likeAudioVolume : 50, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.likeAudioVolume !== undefined ? overlays.likeAudioVolume : 50,
    onChange: e => setOverlays({
      ...overlays,
      likeAudioVolume: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Lector de Voz (TTS Espa\xF1ol)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.likeTtsEnabled,
    onChange: e => setOverlays({
      ...overlays,
      likeTtsEnabled: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      handleSaveOverlaysConfigOnly('Likes');
      setShowLikesPersonalize(false);
    },
    style: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Configuraci\xF3n de Likes"))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Likes'),
    style: {
      marginTop: '15px',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Configuraci\xF3n de Likes")), /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      borderLeft: '4px solid #f59e0b'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      color: '#f59e0b',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }
  }, "\uD83C\uDF81 Alerta de Regalos Recibidos"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-secondary)'
    }
  }, "Se activa al recibir regalos de TikTok (configurable por monedas).")), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      borderBottom: 'none',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.enableGiftAlert,
    onChange: e => setOverlays({
      ...overlays,
      enableGiftAlert: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), overlays.enableGiftAlert && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "preview-panel",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa (Regalos)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-alerts-gift",
    src: "./alerts_overlay.html?type=gift",
    className: "preview-iframe",
    style: {
      height: '480px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 480 \xD7 550 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row",
    style: {
      display: 'flex',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/alerts_overlay.html?type=gift`,
    onClick: e => e.target.select(),
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/alerts_overlay.html?type=gift`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => triggerOverlayTest('gift_rose'),
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '6px',
      color: '#f59e0b',
      borderColor: '#f59e0b',
      padding: '6px 12px'
    }
  }, "\uD83C\uDF39 Probar Rosa"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => triggerOverlayTest('gift_lion'),
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '6px',
      color: '#ec4899',
      borderColor: '#ec4899',
      padding: '6px 12px'
    }
  }, "\uD83E\uDD81 Probar Le\xF3n"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      setShowGiftPersonalize(true);
      triggerOverlayTest('gift_rose');
    },
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '6px',
      color: '#a855f7',
      borderColor: '#a855f7',
      padding: '6px 12px'
    }
  }, "\u2699\uFE0F Personalizar"))), showGiftPersonalize && /*#__PURE__*/React.createElement("div", {
    className: "draggable-personalize-modal",
    style: {
      left: `${giftModalPos.x}px`,
      top: `${giftModalPos.y}px`
    },
    onMouseDown: handleMouseDownGiftModal
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-drag-handle gift-drag-handle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-title"
  }, "\uD83C\uDF81 Configuraci\xF3n de Alerta de Regalos"), /*#__PURE__*/React.createElement("button", {
    className: "btn-close-modal",
    onClick: () => setShowGiftPersonalize(false)
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(overlays.giftOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.giftOpacity,
    onChange: e => setOverlays({
      ...overlays,
      giftOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", overlays.giftRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.giftRadius,
    onChange: e => setOverlays({
      ...overlays,
      giftRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o Letra: ", overlays.giftFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.giftFontSize,
    onChange: e => setOverlays({
      ...overlays,
      giftFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2728 Ajustes de Contenedor y Tipograf\xEDa"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Fondo de Cristal (Tarjeta)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Fondo"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.giftShowCard,
    onChange: e => setOverlays({
      ...overlays,
      giftShowCard: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.01)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.04)',
      marginTop: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#a855f7',
      fontSize: '0.85rem'
    }
  }, "Personalizar Contorno (Borde)"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor Contorno: ", overlays.giftBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.giftBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      giftBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.giftBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      giftBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.giftBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      giftBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Contorno: ", overlays.giftBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.giftBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      giftBorderOpacity: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Familia de Fuente"), /*#__PURE__*/React.createElement("select", {
    value: overlays.giftFontFamily,
    onChange: e => setOverlays({
      ...overlays,
      giftFontFamily: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "Outfit"
  }, "Outfit (Moderna)"), /*#__PURE__*/React.createElement("option", {
    value: "Inter"
  }, "Inter (Limpia)"), /*#__PURE__*/React.createElement("option", {
    value: "Rubik"
  }, "Rubik (Geom\xE9trica)"), /*#__PURE__*/React.createElement("option", {
    value: "Montserrat"
  }, "Montserrat (Robusta)"), /*#__PURE__*/React.createElement("option", {
    value: "Poppins"
  }, "Poppins (Redondeada)"), /*#__PURE__*/React.createElement("option", {
    value: "Cinzel"
  }, "Cinzel (Elegante G\xF3tica)"), /*#__PURE__*/React.createElement("option", {
    value: "Fredoka"
  }, "Fredoka (Divertida Curva)"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Sombras y Contorno de Texto"), /*#__PURE__*/React.createElement("select", {
    value: overlays.giftTextShadow,
    onChange: e => setOverlays({
      ...overlays,
      giftTextShadow: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno (Plano)"), /*#__PURE__*/React.createElement("option", {
    value: "subtle"
  }, "Sutil (Sombra Suave)"), /*#__PURE__*/React.createElement("option", {
    value: "3d-retro"
  }, "3D Retro (Efecto Cl\xE1sico)"), /*#__PURE__*/React.createElement("option", {
    value: "neon-glow"
  }, "Brillo de Ne\xF3n (Resplandor)"), /*#__PURE__*/React.createElement("option", {
    value: "thick-stroke"
  }, "Delineado Grueso (Outline)")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83D\uDCAC Contenido de Alerta"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Mensaje (", `{giftName}`, ", `", `{repeatCount}`, ", `", `{coins}`, ")"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: overlays.giftsAlertMsg,
    onChange: e => setOverlays({
      ...overlays,
      giftsAlertMsg: e.target.value
    }),
    placeholder: "\xA1Gracias por {repeatCount}x {giftName}! \uD83C\uDF81"
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Monedas M\xEDnimas para Alerta"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: overlays.minCoinsAlert,
    onChange: e => setOverlays({
      ...overlays,
      minCoinsAlert: parseInt(e.target.value) || 1
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2699\uFE0F Efectos Habilitados"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Texto Gradiente Animado (Arco\xEDris)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.giftRainbowText,
    onChange: e => setOverlays({
      ...overlays,
      giftRainbowText: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efecto Rebote 3D de Letras"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.giftBounceText,
    onChange: e => setOverlays({
      ...overlays,
      giftBounceText: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Animaciones Lottie Premium"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.giftShowLottie,
    onChange: e => setOverlays({
      ...overlays,
      giftShowLottie: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efectos de Sonido en Alerta"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.giftPlayAudio,
    onChange: e => setOverlays({
      ...overlays,
      giftPlayAudio: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), overlays.giftPlayAudio && /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      paddingLeft: '15px',
      marginTop: '5px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Volumen del Sonido: ", overlays.giftAudioVolume !== undefined ? overlays.giftAudioVolume : 50, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.giftAudioVolume !== undefined ? overlays.giftAudioVolume : 50,
    onChange: e => setOverlays({
      ...overlays,
      giftAudioVolume: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Lector de Voz (TTS Espa\xF1ol)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.giftTtsEnabled,
    onChange: e => setOverlays({
      ...overlays,
      giftTtsEnabled: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      handleSaveOverlaysConfigOnly('Regalos');
      setShowGiftPersonalize(false);
    },
    style: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Configuraci\xF3n de Regalos"))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Regalos'),
    style: {
      marginTop: '15px',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Configuraci\xF3n de Regalos")), /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      borderLeft: '4px solid #06b6d4'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      color: '#06b6d4',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }
  }, "\u2B50 Alerta de Nuevos Suscriptores"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-secondary)'
    }
  }, "Se activa cuando un espectador adquiere una suscripci\xF3n de pago en tu live.")), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      borderBottom: 'none',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.enableSubscribeAlert,
    onChange: e => setOverlays({
      ...overlays,
      enableSubscribeAlert: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), overlays.enableSubscribeAlert && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "preview-panel",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa (Suscriptores)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-alerts-subscribe",
    src: "./alerts_overlay.html?type=subscribe",
    className: "preview-iframe",
    style: {
      height: '480px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 480 \xD7 550 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row",
    style: {
      display: 'flex',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/alerts_overlay.html?type=subscribe`,
    onClick: e => e.target.select(),
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/alerts_overlay.html?type=subscribe`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => triggerOverlayTest('subscribe'),
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#06b6d4',
      borderColor: '#06b6d4'
    }
  }, "\uD83E\uDDEA Probar Alerta"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      setShowSubscribePersonalize(true);
      triggerOverlayTest('subscribe');
    },
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#a855f7',
      borderColor: '#a855f7'
    }
  }, "\u2699\uFE0F Personalizar Alerta"))), showSubscribePersonalize && /*#__PURE__*/React.createElement("div", {
    className: "draggable-personalize-modal",
    style: {
      left: `${subscribeModalPos.x}px`,
      top: `${subscribeModalPos.y}px`
    },
    onMouseDown: handleMouseDownSubscribeModal
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-drag-handle subscribe-drag-handle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-title"
  }, "\u2B50 Configuraci\xF3n de Alerta de Suscriptores"), /*#__PURE__*/React.createElement("button", {
    className: "btn-close-modal",
    onClick: () => setShowSubscribePersonalize(false)
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(overlays.subscribeOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.subscribeOpacity,
    onChange: e => setOverlays({
      ...overlays,
      subscribeOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", overlays.subscribeRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.subscribeRadius,
    onChange: e => setOverlays({
      ...overlays,
      subscribeRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o Letra: ", overlays.subscribeFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.subscribeFontSize,
    onChange: e => setOverlays({
      ...overlays,
      subscribeFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2728 Ajustes de Contenedor y Tipograf\xEDa"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Fondo de Cristal (Tarjeta)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Fondo"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.subscribeShowCard,
    onChange: e => setOverlays({
      ...overlays,
      subscribeShowCard: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.01)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.04)',
      marginTop: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#a855f7',
      fontSize: '0.85rem'
    }
  }, "Personalizar Contorno (Borde)"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor Contorno: ", overlays.subscribeBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.subscribeBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      subscribeBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.subscribeBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      subscribeBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.subscribeBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      subscribeBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Contorno: ", overlays.subscribeBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.subscribeBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      subscribeBorderOpacity: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Familia de Fuente"), /*#__PURE__*/React.createElement("select", {
    value: overlays.subscribeFontFamily,
    onChange: e => setOverlays({
      ...overlays,
      subscribeFontFamily: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "Outfit"
  }, "Outfit (Moderna)"), /*#__PURE__*/React.createElement("option", {
    value: "Inter"
  }, "Inter (Limpia)"), /*#__PURE__*/React.createElement("option", {
    value: "Rubik"
  }, "Rubik (Geom\xE9trica)"), /*#__PURE__*/React.createElement("option", {
    value: "Montserrat"
  }, "Montserrat (Robusta)"), /*#__PURE__*/React.createElement("option", {
    value: "Poppins"
  }, "Poppins (Redondeada)"), /*#__PURE__*/React.createElement("option", {
    value: "Cinzel"
  }, "Cinzel (Elegante G\xF3tica)"), /*#__PURE__*/React.createElement("option", {
    value: "Fredoka"
  }, "Fredoka (Divertida Curva)"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Sombras y Contorno de Texto"), /*#__PURE__*/React.createElement("select", {
    value: overlays.subscribeTextShadow,
    onChange: e => setOverlays({
      ...overlays,
      subscribeTextShadow: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno (Plano)"), /*#__PURE__*/React.createElement("option", {
    value: "subtle"
  }, "Sutil (Sombra Suave)"), /*#__PURE__*/React.createElement("option", {
    value: "3d-retro"
  }, "3D Retro (Efecto Cl\xE1sico)"), /*#__PURE__*/React.createElement("option", {
    value: "neon-glow"
  }, "Brillo de Ne\xF3n (Resplandor)"), /*#__PURE__*/React.createElement("option", {
    value: "thick-stroke"
  }, "Delineado Grueso (Outline)")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83D\uDCAC Contenido de Alerta"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Mensaje (", `{user}`, ")"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: overlays.subsAlertMsg,
    onChange: e => setOverlays({
      ...overlays,
      subsAlertMsg: e.target.value
    }),
    placeholder: "\xA1gracias por suscribirte al canal! \u2B50"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2699\uFE0F Efectos Habilitados"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Texto Gradiente Animado (Arco\xEDris)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.subscribeRainbowText,
    onChange: e => setOverlays({
      ...overlays,
      subscribeRainbowText: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efecto Rebote 3D de Letras"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.subscribeBounceText,
    onChange: e => setOverlays({
      ...overlays,
      subscribeBounceText: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Animaciones Lottie Premium"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.subscribeShowLottie,
    onChange: e => setOverlays({
      ...overlays,
      subscribeShowLottie: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efectos de Sonido en Alerta"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.subscribePlayAudio,
    onChange: e => setOverlays({
      ...overlays,
      subscribePlayAudio: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), overlays.subscribePlayAudio && /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      paddingLeft: '15px',
      marginTop: '5px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Volumen del Sonido: ", overlays.subscribeAudioVolume !== undefined ? overlays.subscribeAudioVolume : 50, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.subscribeAudioVolume !== undefined ? overlays.subscribeAudioVolume : 50,
    onChange: e => setOverlays({
      ...overlays,
      subscribeAudioVolume: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Lector de Voz (TTS Espa\xF1ol)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.subscribeTtsEnabled,
    onChange: e => setOverlays({
      ...overlays,
      subscribeTtsEnabled: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      handleSaveOverlaysConfigOnly('Suscriptores');
      setShowSubscribePersonalize(false);
    },
    style: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Configuraci\xF3n de Suscriptores"))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Suscriptores'),
    style: {
      marginTop: '15px',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Configuraci\xF3n de Suscriptores"))), activeSub === 'topgifters' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83C\uDFC6 Tabla de Clasificaci\xF3n de Donadores (Top Gifter)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Superposici\xF3n premium en tiempo real que lista y ordena a los espectadores que env\xEDan m\xE1s regalos."), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live Ranking")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-topgifters",
    src: "./topgifter_overlay.html",
    className: "preview-iframe",
    style: {
      height: '420px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 340 \xD7 600 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/topgifter_overlay.html`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/topgifter_overlay.html`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => triggerOverlayTest('topgifters'),
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#ec4899',
      borderColor: '#ec4899'
    }
  }, "\uD83E\uDDEA Probar Overlay"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      setShowTopgifterPersonalize(true);
      triggerOverlayTest('topgifters');
    },
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#a855f7',
      borderColor: '#a855f7'
    }
  }, "\u2699\uFE0F Personalizar Dise\xF1o")), showTopgifterPersonalize && /*#__PURE__*/React.createElement("div", {
    className: "draggable-personalize-modal",
    style: {
      left: `${topgifterModalPos.x}px`,
      top: `${topgifterModalPos.y}px`
    },
    onMouseDown: handleMouseDownTopgifterModal
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-drag-handle topgifter-drag-handle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-title"
  }, "\uD83C\uDFC6 Configuraci\xF3n de Tabla de Clasificaci\xF3n"), /*#__PURE__*/React.createElement("button", {
    className: "btn-close-modal",
    onClick: () => setShowTopgifterPersonalize(false)
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(overlays.topgifterOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.topgifterOpacity,
    onChange: e => setOverlays({
      ...overlays,
      topgifterOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", overlays.topgifterRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.topgifterRadius,
    onChange: e => setOverlays({
      ...overlays,
      topgifterRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o Letra: ", overlays.topgifterFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.topgifterFontSize,
    onChange: e => setOverlays({
      ...overlays,
      topgifterFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2728 Dise\xF1o y Estructura de Tarjeta"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Fondo de Cristal (Tarjeta)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Fondo"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifterShowCardBg,
    onChange: e => setOverlays({
      ...overlays,
      topgifterShowCardBg: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Ancho del Ranking: ", overlays.topgifterWidth || 340, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "200",
    max: "600",
    step: "10",
    value: overlays.topgifterWidth || 340,
    onChange: e => setOverlays({
      ...overlays,
      topgifterWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Separaci\xF3n entre Tarjetas: ", overlays.topgifterGap || 6, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "25",
    step: "1",
    value: overlays.topgifterGap || 6,
    onChange: e => setOverlays({
      ...overlays,
      topgifterGap: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Espaciado Interno (Padding)"), /*#__PURE__*/React.createElement("select", {
    value: overlays.topgifterCardPadding || 'medium',
    onChange: e => setOverlays({
      ...overlays,
      topgifterCardPadding: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "small"
  }, "Peque\xF1o"), /*#__PURE__*/React.createElement("option", {
    value: "medium"
  }, "Mediano"), /*#__PURE__*/React.createElement("option", {
    value: "large"
  }, "Grande"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Duraci\xF3n Animaci\xF3n Entrada: ", overlays.topgifterAnimationDuration || 0.35, "s"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "2",
    step: "0.05",
    value: overlays.topgifterAnimationDuration || 0.35,
    onChange: e => setOverlays({
      ...overlays,
      topgifterAnimationDuration: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.01)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.04)',
      marginTop: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#a855f7',
      fontSize: '0.85rem'
    }
  }, "Personalizar Contorno (Borde)"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor Contorno: ", overlays.topgifterBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.topgifterBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      topgifterBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.topgifterBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      topgifterBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.topgifterBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      topgifterBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Contorno: ", overlays.topgifterBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.topgifterBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      topgifterBorderOpacity: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.01)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.04)',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#a855f7',
      fontSize: '0.85rem'
    }
  }, "Personalizar Sombra de Tarjeta"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Sombra"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifterShowShadow,
    onChange: e => setOverlays({
      ...overlays,
      topgifterShowShadow: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Sombra"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.topgifterShadowColor || '#000000',
    onChange: e => setOverlays({
      ...overlays,
      topgifterShadowColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Desenfoque: ", overlays.topgifterShadowBlur || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.topgifterShadowBlur || 0,
    onChange: e => setOverlays({
      ...overlays,
      topgifterShadowBlur: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Sombra: ", overlays.topgifterShadowOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.topgifterShadowOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      topgifterShadowOpacity: parseInt(e.target.value)
    })
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#a855f7'
    }
  }, "\u2699\uFE0F Opciones de Tabla"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Corona de Oro en el 1er Lugar \uD83D\uDC51"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifter_show_crown,
    onChange: e => setOverlays({
      ...overlays,
      topgifter_show_crown: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar S\xEDmbolo de Monedas (Coins) \uD83D\uDC8E"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifter_show_coin_symbol,
    onChange: e => setOverlays({
      ...overlays,
      topgifter_show_coin_symbol: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("h4", {
    style: {
      margin: '15px 0 10px 0',
      color: '#a855f7'
    }
  }, "\u2728 Animaciones de Tabla"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Texto Gradiente Animado (Arco\xEDris) \uD83C\uDF08"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifter_rainbow_username,
    onChange: e => setOverlays({
      ...overlays,
      topgifter_rainbow_username: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efecto Rebote 3D de Letras \uD83E\uDD98"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifter_bounce_username,
    onChange: e => setOverlays({
      ...overlays,
      topgifter_bounce_username: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Animar Latido de Monedas al Sumar \uD83D\uDC93"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifter_bounce_coins,
    onChange: e => setOverlays({
      ...overlays,
      topgifter_bounce_coins: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.02)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.06)',
      marginTop: '15px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#a855f7',
      fontSize: '0.85rem',
      display: 'block',
      marginBottom: '10px'
    }
  }, "\uD83C\uDFC6 Personalizaci\xF3n de Puestos (Ranking)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Fondo Arco\xEDris Animado \uD83C\uDF08"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifter_rainbow_rank,
    onChange: e => setOverlays({
      ...overlays,
      topgifter_rainbow_rank: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efecto Rebote 3D \uD83E\uDD98"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topgifter_bounce_rank,
    onChange: e => setOverlays({
      ...overlays,
      topgifter_bounce_rank: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), !overlays.topgifter_rainbow_rank && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '8px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '0.75rem',
      marginBottom: '4px',
      display: 'block'
    }
  }, "1er Lugar"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.topgifter_first_place_color || '#ffd700',
    onChange: e => setOverlays({
      ...overlays,
      topgifter_first_place_color: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '0.75rem',
      marginBottom: '4px',
      display: 'block'
    }
  }, "2do Lugar"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.topgifter_second_place_color || '#cbd5e1',
    onChange: e => setOverlays({
      ...overlays,
      topgifter_second_place_color: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '0.75rem',
      marginBottom: '4px',
      display: 'block'
    }
  }, "3er Lugar"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.topgifter_third_place_color || '#cd7f32',
    onChange: e => setOverlays({
      ...overlays,
      topgifter_third_place_color: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '12px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "M\xE1ximo de Donadores en OBS"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "3",
    max: "30",
    value: overlays.topgifter_max,
    onChange: e => setOverlays({
      ...overlays,
      topgifter_max: parseInt(e.target.value) || 10
    })
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      handleSaveOverlaysConfigOnly('Top Gifter');
      setShowTopgifterPersonalize(false);
    },
    style: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Dise\xF1o")))), activeSub === 'toplikers' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\u2764\uFE0F Tabla de Clasificaci\xF3n de Likes (Top Liker)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Superposici\xF3n premium en tiempo real que lista y ordena a los espectadores con m\xE1s likes de la sesi\xF3n actual."), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot",
    style: {
      backgroundColor: '#ff4a6e',
      boxShadow: '0 0 8px #ff4a6e'
    }
  }), " Live Ranking")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-toplikers",
    src: "./topliker_overlay.html",
    className: "preview-iframe",
    style: {
      height: '420px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 340 \xD7 600 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/topliker_overlay.html`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/topliker_overlay.html`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => triggerOverlayTest('toplikers'),
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#ff4a6e',
      borderColor: '#ff4a6e'
    }
  }, "\uD83E\uDDEA Probar Overlay"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      setShowToplikerPersonalize(true);
      triggerOverlayTest('toplikers');
    },
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      color: '#ff85a7',
      borderColor: '#ff85a7'
    }
  }, "\u2699\uFE0F Personalizar Dise\xF1o")), showToplikerPersonalize && /*#__PURE__*/React.createElement("div", {
    className: "draggable-personalize-modal",
    style: {
      left: `${toplikerModalPos.x}px`,
      top: `${toplikerModalPos.y}px`
    },
    onMouseDown: handleMouseDownToplikerModal
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-drag-handle topliker-drag-handle",
    style: {
      background: 'linear-gradient(90deg, rgba(255,94,126,0.15), rgba(255,51,102,0.15))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-title"
  }, "\u2764\uFE0F Configuraci\xF3n de Tabla de Clasificaci\xF3n de Likes"), /*#__PURE__*/React.createElement("button", {
    className: "btn-close-modal",
    onClick: () => setShowToplikerPersonalize(false)
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "personalize-modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#ff5e7e'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(overlays.toplikerOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.toplikerOpacity,
    onChange: e => setOverlays({
      ...overlays,
      toplikerOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", overlays.toplikerRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.toplikerRadius,
    onChange: e => setOverlays({
      ...overlays,
      toplikerRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o Letra: ", overlays.toplikerFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.toplikerFontSize,
    onChange: e => setOverlays({
      ...overlays,
      toplikerFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#ff5e7e'
    }
  }, "\u2728 Dise\xF1o y Estructura de Tarjeta"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Fondo de Cristal (Tarjeta)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Fondo"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.toplikerShowCardBg,
    onChange: e => setOverlays({
      ...overlays,
      toplikerShowCardBg: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Ancho del Ranking: ", overlays.toplikerWidth || 340, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "200",
    max: "600",
    step: "10",
    value: overlays.toplikerWidth || 340,
    onChange: e => setOverlays({
      ...overlays,
      toplikerWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Separaci\xF3n entre Tarjetas: ", overlays.toplikerGap || 6, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "25",
    step: "1",
    value: overlays.toplikerGap || 6,
    onChange: e => setOverlays({
      ...overlays,
      toplikerGap: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Espaciado Interno (Padding)"), /*#__PURE__*/React.createElement("select", {
    value: overlays.toplikerCardPadding || 'medium',
    onChange: e => setOverlays({
      ...overlays,
      toplikerCardPadding: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "small"
  }, "Peque\xF1o"), /*#__PURE__*/React.createElement("option", {
    value: "medium"
  }, "Mediano"), /*#__PURE__*/React.createElement("option", {
    value: "large"
  }, "Grande"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Duraci\xF3n Animaci\xF3n Entrada: ", overlays.toplikerAnimationDuration || 0.35, "s"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "2",
    step: "0.05",
    value: overlays.toplikerAnimationDuration || 0.35,
    onChange: e => setOverlays({
      ...overlays,
      toplikerAnimationDuration: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.01)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.04)',
      marginTop: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#ff5e7e',
      fontSize: '0.85rem'
    }
  }, "Personalizar Contorno (Borde)"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Grosor Contorno: ", overlays.toplikerBorderWidth || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "10",
    step: "1",
    value: overlays.toplikerBorderWidth || 0,
    onChange: e => setOverlays({
      ...overlays,
      toplikerBorderWidth: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Estilo Contorno"), /*#__PURE__*/React.createElement("select", {
    value: overlays.toplikerBorderStyle || 'solid',
    onChange: e => setOverlays({
      ...overlays,
      toplikerBorderStyle: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      padding: '0 10px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      border: '1px solid var(--border-glass)',
      borderRadius: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "solid"
  }, "S\xF3lido"), /*#__PURE__*/React.createElement("option", {
    value: "dashed"
  }, "Segmentado"), /*#__PURE__*/React.createElement("option", {
    value: "dotted"
  }, "Puntos"), /*#__PURE__*/React.createElement("option", {
    value: "double"
  }, "Doble"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "Ninguno")))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.toplikerBorderColor || '#ffffff',
    onChange: e => setOverlays({
      ...overlays,
      toplikerBorderColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Contorno: ", overlays.toplikerBorderOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.toplikerBorderOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      toplikerBorderOpacity: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.01)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.04)',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#ff5e7e',
      fontSize: '0.85rem'
    }
  }, "Personalizar Sombra de Tarjeta"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Sombra"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.toplikerShowShadow,
    onChange: e => setOverlays({
      ...overlays,
      toplikerShowShadow: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Sombra"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.toplikerShadowColor || '#000000',
    onChange: e => setOverlays({
      ...overlays,
      toplikerShadowColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Desenfoque: ", overlays.toplikerShadowBlur || 0, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.toplikerShadowBlur || 0,
    onChange: e => setOverlays({
      ...overlays,
      toplikerShadowBlur: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Sombra: ", overlays.toplikerShadowOpacity || 0, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.toplikerShadowOpacity || 0,
    onChange: e => setOverlays({
      ...overlays,
      toplikerShadowOpacity: parseInt(e.target.value)
    })
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: '#ff5e7e'
    }
  }, "\u2699\uFE0F Opciones de Tabla"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar Corona en el 1er Lugar \uD83D\uDC51"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topliker_show_crown,
    onChange: e => setOverlays({
      ...overlays,
      topliker_show_crown: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrar S\xEDmbolo de Coraz\xF3n \u2764\uFE0F"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topliker_show_heart_symbol,
    onChange: e => setOverlays({
      ...overlays,
      topliker_show_heart_symbol: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("h4", {
    style: {
      margin: '15px 0 10px 0',
      color: '#ff5e7e'
    }
  }, "\u2728 Animaciones de Tabla"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Texto Gradiente Animado (Arco\xEDris) \uD83C\uDF08"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topliker_rainbow_username,
    onChange: e => setOverlays({
      ...overlays,
      topliker_rainbow_username: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efecto Rebote 3D de Letras \uD83E\uDD98"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topliker_bounce_username,
    onChange: e => setOverlays({
      ...overlays,
      topliker_bounce_username: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '8px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Animar Latido de Likes al Sumar \uD83D\uDC93"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topliker_bounce_likes,
    onChange: e => setOverlays({
      ...overlays,
      topliker_bounce_likes: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.02)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.06)',
      marginTop: '15px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 'bold',
      color: '#ff5e7e',
      fontSize: '0.85rem',
      display: 'block',
      marginBottom: '10px'
    }
  }, "\uD83C\uDFC6 Personalizaci\xF3n de Puestos (Ranking)"), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Fondo Arco\xEDris Animado \uD83C\uDF08"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topliker_rainbow_rank,
    onChange: e => setOverlays({
      ...overlays,
      topliker_rainbow_rank: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      padding: '6px 0',
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Efecto Rebote 3D \uD83E\uDD98"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.topliker_bounce_rank,
    onChange: e => setOverlays({
      ...overlays,
      topliker_bounce_rank: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), !overlays.topliker_rainbow_rank && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '8px',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '0.75rem',
      marginBottom: '4px',
      display: 'block'
    }
  }, "1er Lugar"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.topliker_first_place_color || '#ff4d6d',
    onChange: e => setOverlays({
      ...overlays,
      topliker_first_place_color: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '0.75rem',
      marginBottom: '4px',
      display: 'block'
    }
  }, "2do Lugar"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.topliker_second_place_color || '#cbd5e1',
    onChange: e => setOverlays({
      ...overlays,
      topliker_second_place_color: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '0.75rem',
      marginBottom: '4px',
      display: 'block'
    }
  }, "3er Lugar"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.topliker_third_place_color || '#fb923c',
    onChange: e => setOverlays({
      ...overlays,
      topliker_third_place_color: e.target.value
    }),
    style: {
      width: '100%',
      height: '36px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '8px'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '12px',
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '0.75rem',
      marginBottom: '4px',
      display: 'block'
    }
  }, "Tiempo L\xEDmite de Inactividad (segundos)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "10",
    max: "600",
    value: overlays.topliker_inactivity_threshold || 90,
    onChange: e => setOverlays({
      ...overlays,
      topliker_inactivity_threshold: parseInt(e.target.value) || 90
    }),
    style: {
      width: '100%',
      padding: '6px 10px',
      border: '1px solid #3f3f46',
      borderRadius: '6px',
      background: '#27272a',
      color: '#fff'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '12px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "M\xE1ximo de Likers en OBS"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "3",
    max: "30",
    value: overlays.topliker_max,
    onChange: e => setOverlays({
      ...overlays,
      topliker_max: parseInt(e.target.value) || 10
    })
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => {
      handleSaveOverlaysConfigOnly('Top Liker');
      setShowToplikerPersonalize(false);
    },
    style: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '5px'
    }
  }, renderIcon('save'), " Guardar Dise\xF1o")))), activeSub === 'likeslock' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83D\uDD12 Candado de Enlaces de YouTube (Meta de Likes)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Evita que los usuarios pidan links de YouTube hasta alcanzar una meta configurada de likes en la sesi\xF3n actual."), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "toggle-label"
  }, /*#__PURE__*/React.createElement("span", null, "Habilitar bloqueo por likes en directos"), /*#__PURE__*/React.createElement("small", null, "Si est\xE1 activo, el chat rechazar\xE1 los links si no se ha alcanzado la meta.")), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.enableLikesYoutubeLock,
    onChange: e => setOverlays({
      ...overlays,
      enableLikesYoutubeLock: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Meta de Likes de Live requerida"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: overlays.likesTargetForYoutubeLink,
    onChange: e => setOverlays({
      ...overlays,
      likesTargetForYoutubeLink: parseInt(e.target.value) || 999
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Mensaje de Enlaces Bloqueados"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: overlays.likesLockAlertMsg,
    onChange: e => setOverlays({
      ...overlays,
      likesLockAlertMsg: e.target.value
    })
  }), /*#__PURE__*/React.createElement("small", null, "Usa ", /*#__PURE__*/React.createElement("code", null, `{faltan}, {llevamos}, {meta}`), " para auto-rellenar las estad\xEDsticas en caliente.")), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(255,255,255,0.06)',
      marginTop: '20px',
      paddingTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(overlays.likeslockOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.likeslockOpacity,
    onChange: e => setOverlays({
      ...overlays,
      likeslockOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", overlays.likeslockRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: overlays.likeslockRadius,
    onChange: e => setOverlays({
      ...overlays,
      likeslockRadius: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Candado'),
    style: {
      marginTop: '10px'
    }
  }, renderIcon('save'), " Guardar Dise\xF1o")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-red",
    style: {
      marginTop: '20px'
    },
    onClick: () => triggerOverlayTest('like_lock_blocked')
  }, "\uD83D\uDD12 Simular Alerta de Enlace Bloqueado")), activeSub === 'ticker' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83D\uDCC8 Ticker de Estad\xEDsticas en Vivo (Scrolling Ticker)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Marquesina horizontal animada para la parte inferior/superior de tu directo que avisa stats, follows y canciones pasadas."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '20px',
      paddingBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad del Fondo: ", Math.round(overlays.tickerOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: overlays.tickerOpacity,
    onChange: e => setOverlays({
      ...overlays,
      tickerOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tama\xF1o de Letra: ", overlays.tickerFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: overlays.tickerFontSize,
    onChange: e => setOverlays({
      ...overlays,
      tickerFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleSaveOverlaysConfigOnly('Ticker'),
    style: {
      marginTop: '10px'
    }
  }, renderIcon('save'), " Guardar Dise\xF1o")), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live Ticker")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-ticker",
    src: "./stats_ticker_widget.html",
    className: "preview-iframe",
    style: {
      height: '180px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 1920 \xD7 60 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/stats_ticker_widget.html`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/stats_ticker_widget.html`)
  }, "Copiar URL")))), activeSub === 'goals' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      marginBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '5px'
    }
  }, "\uD83C\uDFAF Metas de Stream Activas (Goal Overlays)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      margin: 0
    }
  }, "Controla hasta 4 barras de progreso visuales animadas en OBS ejecut\xE1ndose en paralelo.")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-danger",
    onClick: triggerGoalsReset,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, renderIcon('trash'), " Resetear Todos los Contadores"))), [{
    key: 'follows',
    title: 'Meta de Seguidores',
    emoji: '👥',
    color: '#7c3aed',
    placeholder: 'Seguidores'
  }, {
    key: 'likes',
    title: 'Meta de Likes',
    emoji: '❤️',
    color: '#ec4899',
    placeholder: 'Likes'
  }, {
    key: 'shares',
    title: 'Meta de Compartidos',
    emoji: '🔁',
    color: '#10b981',
    placeholder: 'Compartidos'
  }, {
    key: 'coins',
    title: 'Meta de Regalos (Monedas)',
    emoji: '🪙',
    color: '#eab308',
    placeholder: 'Monedas'
  }].map(t => {
    const config = goals[t.key] || {};
    const obsUrl = `${currentOrigin}/goal_overlay.html?type=${t.key}`;
    const showModalState = {
      follows: showGoalsFollowsPersonalize,
      likes: showGoalsLikesPersonalize,
      shares: showGoalsSharesPersonalize,
      coins: showGoalsCoinsPersonalize
    }[t.key];
    const setShowModalState = {
      follows: setShowGoalsFollowsPersonalize,
      likes: setShowGoalsLikesPersonalize,
      shares: setShowGoalsSharesPersonalize,
      coins: setShowGoalsCoinsPersonalize
    }[t.key];
    const modalPos = {
      follows: goalsFollowsModalPos,
      likes: goalsLikesModalPos,
      shares: goalsSharesModalPos,
      coins: goalsCoinsModalPos
    }[t.key];
    const handleMouseDown = {
      follows: handleMouseDownGoalsFollowsModal,
      likes: handleMouseDownGoalsLikesModal,
      shares: handleMouseDownGoalsSharesModal,
      coins: handleMouseDownGoalsCoinsModal
    }[t.key];
    return /*#__PURE__*/React.createElement("div", {
      key: t.key,
      className: "glass-card",
      style: {
        marginBottom: '30px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: '15px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '1.5rem'
      }
    }, t.emoji), /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0,
        fontSize: '1.2rem',
        fontWeight: 700
      }
    }, t.title)), /*#__PURE__*/React.createElement("div", {
      className: "toggle-row",
      style: {
        borderBottom: 'none',
        padding: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        marginRight: '10px',
        fontSize: '0.88rem',
        color: config.enabled ? t.color : 'var(--text-secondary)'
      }
    }, config.enabled ? 'Habilitada' : 'Deshabilitada'), /*#__PURE__*/React.createElement("label", {
      className: "switch"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: !!config.enabled,
      onChange: e => {
        const updated = {
          ...goals
        };
        updated[t.key] = {
          ...config,
          enabled: e.target.checked
        };
        setGoals(updated);
        handleSaveGoalsConfig(t.key);
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "slider"
    })))), config.enabled && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "grid-2"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "form-group",
      style: {
        marginBottom: '15px'
      }
    }, /*#__PURE__*/React.createElement("label", null, "Meta Objetivo (", t.placeholder, ")"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: config.goalTarget || '',
      onChange: e => {
        const updated = {
          ...goals
        };
        updated[t.key] = {
          ...config,
          goalTarget: parseInt(e.target.value) || 0
        };
        setGoals(updated);
      },
      placeholder: `Ej: ${config.goalTarget}`
    })), /*#__PURE__*/React.createElement("div", {
      className: "form-group",
      style: {
        marginBottom: '15px'
      }
    }, /*#__PURE__*/React.createElement("label", null, "T\xEDtulo de la Meta"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: config.goalLabel || '',
      onChange: e => {
        const updated = {
          ...goals
        };
        updated[t.key] = {
          ...config,
          goalLabel: e.target.value
        };
        setGoals(updated);
      },
      placeholder: "Ej: \xA1Meta de seguidores!"
    })), /*#__PURE__*/React.createElement("div", {
      className: "form-group",
      style: {
        marginBottom: '15px'
      }
    }, /*#__PURE__*/React.createElement("label", null, "Mensaje de Recompensa (Al completar)"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: config.goalRewardText || '',
      onChange: e => {
        const updated = {
          ...goals
        };
        updated[t.key] = {
          ...config,
          goalRewardText: e.target.value
        };
        setGoals(updated);
      },
      placeholder: "Ej: \xA1Meta alcanzada! \uD83C\uDF89"
    })), /*#__PURE__*/React.createElement("div", {
      className: "form-group",
      style: {
        marginTop: '20px'
      }
    }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 500 \xD7 180 px)"), /*#__PURE__*/React.createElement("div", {
      className: "copy-url-row"
    }, /*#__PURE__*/React.createElement("input", {
      type: "text",
      className: "copy-url-input",
      readOnly: true,
      value: obsUrl,
      onClick: e => e.target.select()
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-secondary",
      onClick: () => handleCopyUrl(obsUrl)
    }, "Copiar URL")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "preview-panel"
    }, /*#__PURE__*/React.createElement("div", {
      className: "preview-header"
    }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "preview-live-dot"
    }), " Live Overlay")), /*#__PURE__*/React.createElement("iframe", {
      id: `iframe-goals-${t.key}`,
      src: `./goal_overlay.html?type=${t.key}`,
      className: "preview-iframe",
      style: {
        height: '180px'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "grid-2",
      style: {
        marginTop: '15px'
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: () => {
        handleSaveGoalsConfig(t.key);
        triggerGoalTest(t.key);
      },
      style: {
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px'
      }
    }, "\u26A1 Simular Progreso"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-secondary",
      onClick: () => {
        setShowModalState(true);
        triggerGoalTest(t.key);
      },
      style: {
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        color: '#a855f7',
        borderColor: '#a855f7'
      }
    }, "\u2699\uFE0F Personalizar Meta"))))), showModalState && /*#__PURE__*/React.createElement("div", {
      className: "draggable-personalize-modal",
      style: {
        left: `${modalPos.x}px`,
        top: `${modalPos.y}px`
      },
      onMouseDown: handleMouseDown
    }, /*#__PURE__*/React.createElement("div", {
      className: "personalize-drag-handle",
      style: {
        borderLeft: `4px solid ${t.color}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "personalize-modal-title"
    }, t.emoji, " Personalizar Meta de ", t.placeholder), /*#__PURE__*/React.createElement("button", {
      className: "btn-close-modal",
      onClick: () => setShowModalState(false)
    }, "\xD7")), /*#__PURE__*/React.createElement("div", {
      className: "personalize-modal-body",
      style: {
        padding: '20px',
        overflowY: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: '25px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: '15px'
      }
    }, /*#__PURE__*/React.createElement("h4", {
      style: {
        marginBottom: '15px',
        color: t.color
      }
    }, "\uD83C\uDFA8 Estilo Visual"), /*#__PURE__*/React.createElement("div", {
      className: "form-group"
    }, /*#__PURE__*/React.createElement("label", null, "Color Primario (Barra/Destello)"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '10px'
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "color",
      value: config.primaryColor || t.color,
      onChange: e => {
        const updated = {
          ...goals
        };
        updated[t.key] = {
          ...config,
          primaryColor: e.target.value
        };
        setGoals(updated);
      },
      style: {
        width: '50px',
        height: '40px',
        padding: '0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer'
      }
    }), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: config.primaryColor || '',
      onChange: e => {
        const updated = {
          ...goals
        };
        updated[t.key] = {
          ...config,
          primaryColor: e.target.value
        };
        setGoals(updated);
      },
      placeholder: "#000000",
      style: {
        flex: 1
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "form-group",
      style: {
        marginTop: '15px'
      }
    }, /*#__PURE__*/React.createElement("label", null, "Opacidad del Cristal: ", Math.round((config.goalsOpacity !== undefined ? config.goalsOpacity : 0.85) * 100), "%"), /*#__PURE__*/React.createElement("input", {
      type: "range",
      min: "0.1",
      max: "1",
      step: "0.05",
      value: config.goalsOpacity !== undefined ? config.goalsOpacity : 0.85,
      onChange: e => {
        const updated = {
          ...goals
        };
        updated[t.key] = {
          ...config,
          goalsOpacity: parseFloat(e.target.value)
        };
        setGoals(updated);
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "form-group",
      style: {
        marginTop: '15px'
      }
    }, /*#__PURE__*/React.createElement("label", null, "Redondeado de Esquinas: ", config.goalsRadius !== undefined ? config.goalsRadius : 22, "px"), /*#__PURE__*/React.createElement("input", {
      type: "range",
      min: "0",
      max: "40",
      step: "2",
      value: config.goalsRadius !== undefined ? config.goalsRadius : 22,
      onChange: e => {
        const updated = {
          ...goals
        };
        updated[t.key] = {
          ...config,
          goalsRadius: parseInt(e.target.value)
        };
        setGoals(updated);
      }
    }))), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-secondary",
      onClick: () => {
        handleSaveGoalsConfig(t.key);
        setShowModalState(false);
      },
      style: {
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: '5px'
      }
    }, renderIcon('save'), " Guardar Meta de ", t.placeholder))));
  })), activeSub === 'timer' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\u23F1\uFE0F Timer Countdown Interactivo"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Cuenta regresiva controlable. Los viewers pueden regalar y a\xF1adir segundos al tiempo en OBS."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '20px',
      paddingBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "grid-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad: ", Math.round(timer.timerOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: timer.timerOpacity,
    onChange: e => setTimer({
      ...timer,
      timerOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", timer.timerRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: timer.timerRadius,
    onChange: e => setTimer({
      ...timer,
      timerRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Letra: ", timer.timerFontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "24",
    step: "1",
    value: timer.timerFontSize,
    onChange: e => setTimer({
      ...timer,
      timerFontSize: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: handleSaveTimerConfigOnly,
    style: {
      marginTop: '5px'
    }
  }, renderIcon('save'), " Guardar Dise\xF1o")), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live Timer")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-timer",
    src: "./timer_overlay.html",
    className: "preview-iframe",
    style: {
      height: '300px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 320 \xD7 150 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/timer_overlay.html`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/timer_overlay.html`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Duraci\xF3n Inicial (minutos)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "360",
    value: timer.initialDuration,
    onChange: e => setTimer({
      ...timer,
      initialDuration: parseInt(e.target.value) || 30
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Segundos por cada Regalo"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "600",
    value: timer.secondsPerGift,
    onChange: e => setTimer({
      ...timer,
      secondsPerGift: parseInt(e.target.value) || 30
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Texto del Timer"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: timer.label,
    onChange: e => setTimer({
      ...timer,
      label: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color Principal"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: timer.primaryColor,
    onChange: e => setTimer({
      ...timer,
      primaryColor: e.target.value
    }),
    style: {
      width: '100%',
      height: '40px',
      cursor: 'pointer',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '20px',
      padding: '12px 16px',
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px',
      fontSize: '0.9rem',
      color: 'var(--text-secondary)'
    }
  }, timerDisplay), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-green",
    onClick: startActiveTimer
  }, "\u25B6\uFE0F Iniciar/Reiniciar"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-orange",
    onClick: () => handleTimerAction('pause')
  }, "\u23F8\uFE0F Pausar"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-blue",
    onClick: () => handleTimerAction('resume')
  }, "\u25B6\uFE0F Reanudar"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-red",
    onClick: () => handleTimerAction('stop')
  }, "\u23F9\uFE0F Detener")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      fontSize: '0.85rem',
      padding: '8px 14px'
    },
    onClick: () => handleTimerAction('extend', {
      seconds: 300
    })
  }, "+5 min"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      fontSize: '0.85rem',
      padding: '8px 14px'
    },
    onClick: () => handleTimerAction('extend', {
      seconds: 600
    })
  }, "+10 min"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      fontSize: '0.85rem',
      padding: '8px 14px'
    },
    onClick: () => handleTimerAction('extend', {
      seconds: 1800
    })
  }, "+30 min"))), activeSub === 'lastevents' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83D\uDCCB \xDAltimos Eventos del Stream"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Muestra un feed lateral en OBS con follows, suscripciones, compartidos y regalos en tiempo real."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '20px',
      paddingBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "grid-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Opacidad Tarjetas: ", Math.round(lastevents.cardOpacity * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.1",
    max: "1",
    step: "0.05",
    value: lastevents.cardOpacity,
    onChange: e => setLastevents({
      ...lastevents,
      cardOpacity: parseFloat(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Redondeado: ", lastevents.borderRadius, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "30",
    step: "2",
    value: lastevents.borderRadius,
    onChange: e => setLastevents({
      ...lastevents,
      borderRadius: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Letra: ", lastevents.fontSize, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "20",
    step: "1",
    value: lastevents.fontSize,
    onChange: e => setLastevents({
      ...lastevents,
      fontSize: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Live Activity Feed")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-lastevents",
    src: `./last_events_widget.html?maxEvents=${lastevents.maxEvents}&showAvatar=${lastevents.showAvatar}`,
    className: "preview-iframe",
    style: {
      height: '520px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 400 \xD7 620 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/last_events_widget.html?maxEvents=${lastevents.maxEvents}&showAvatar=${lastevents.showAvatar}`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/last_events_widget.html?maxEvents=${lastevents.maxEvents}&showAvatar=${lastevents.showAvatar}`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "M\xE1ximo de Eventos a mostrar"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "20",
    value: lastevents.maxEvents,
    onChange: e => setLastevents({
      ...lastevents,
      maxEvents: parseInt(e.target.value) || 6
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Mostrar Avatares"), /*#__PURE__*/React.createElement("select", {
    value: String(lastevents.showAvatar),
    onChange: e => setLastevents({
      ...lastevents,
      showAvatar: e.target.value === 'true'
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "true"
  }, "\u2705 Mostrar"), /*#__PURE__*/React.createElement("option", {
    value: "false"
  }, "\u274C Ocultar")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Filtros de Eventos a Mostrar"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '15px',
      padding: '12px 16px',
      background: 'rgba(0,0,0,0.2)',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: lastevents.showFollows,
    onChange: e => setLastevents({
      ...lastevents,
      showFollows: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), " Seguidores"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: lastevents.showGifts,
    onChange: e => setLastevents({
      ...lastevents,
      showGifts: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), " Regalos"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: lastevents.showLikes,
    onChange: e => setLastevents({
      ...lastevents,
      showLikes: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), " Likes"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: lastevents.showShares,
    onChange: e => setLastevents({
      ...lastevents,
      showShares: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), " Shares"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: lastevents.showSubscribes,
    onChange: e => setLastevents({
      ...lastevents,
      showSubscribes: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), " Subs"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: handleSaveLastEventsConfig
  }, renderIcon('save'), " Guardar Dise\xF1o & Filtros"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-green",
    onClick: triggerShareEvent
  }, "\uD83E\uDDEA Simular Evento Share"))), activeSub === 'welcome' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83D\uDC4B Alerta de Bienvenida (Join Alert)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Muestra un saludo en pantalla con el avatar y nombre del usuario cuando entra al Live."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '20px',
      paddingBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDFA8 Personalizaci\xF3n Visual Independiente"), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Color de Contorno / Brillo"), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: overlays.welcomeOverlayColor || '#a855f7',
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlayColor: e.target.value
    }),
    style: {
      height: '40px',
      padding: '2px',
      border: '1px solid rgba(255,255,255,0.1)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Duraci\xF3n (segundos): ", overlays.welcomeOverlayDuration || 5, "s"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "2",
    max: "15",
    step: "1",
    value: overlays.welcomeOverlayDuration || 5,
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlayDuration: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "preview-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-header"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCFA Vista Previa en Vivo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-live-dot"
  }), " Join Alert Overlay")), /*#__PURE__*/React.createElement("iframe", {
    id: "iframe-welcome",
    src: `./welcome_overlay.html`,
    className: "preview-iframe",
    style: {
      height: '350px',
      background: 'transparent'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Enlace de OBS (Browser Source \u2014 600 \xD7 300 px)"), /*#__PURE__*/React.createElement("div", {
    className: "copy-url-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "copy-url-input",
    readOnly: true,
    value: `${currentOrigin}/welcome_overlay.html`,
    onClick: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => handleCopyUrl(`${currentOrigin}/welcome_overlay.html`)
  }, "Copiar URL"))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Activar Alerta de Bienvenida"), /*#__PURE__*/React.createElement("select", {
    value: String(overlays.welcomeOverlayEnabled),
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlayEnabled: e.target.value === 'true'
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "true"
  }, "\u2705 Activar"), /*#__PURE__*/React.createElement("option", {
    value: "false"
  }, "\u274C Desactivar"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Plantilla de Saludo (usa ", "{user}", " o ", "{nickname}", ")"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: overlays.welcomeOverlayGreetingTemplate || '',
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlayGreetingTemplate: e.target.value
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Efecto de Sonido"), /*#__PURE__*/React.createElement("select", {
    value: String(overlays.welcomeOverlaySoundEnabled),
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlaySoundEnabled: e.target.value === 'true'
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "true"
  }, "\uD83D\uDD0A Habilitar Sonido"), /*#__PURE__*/React.createElement("option", {
    value: "false"
  }, "\uD83D\uDD07 Deshabilitar Sonido"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Volumen del Sonido: ", overlays.welcomeOverlaySoundVolume || 40, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.welcomeOverlaySoundVolume || 40,
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlaySoundVolume: parseInt(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "\xBFQui\xE9n activa esta alerta al entrar?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '15px',
      padding: '12px 16px',
      background: 'rgba(0,0,0,0.2)',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0,
      alignItems: 'center',
      gap: '4px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!overlays.welcomeOverlayAllowAll,
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlayAllowAll: e.target.checked
    }),
    style: {
      width: 'auto',
      margin: 0
    }
  }), " Todos"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0,
      alignItems: 'center',
      gap: '4px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!overlays.welcomeOverlayAllowFollowers,
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlayAllowFollowers: e.target.checked
    }),
    style: {
      width: 'auto',
      margin: 0
    }
  }), " Seguidores"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0,
      alignItems: 'center',
      gap: '4px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!overlays.welcomeOverlayAllowSubscribers,
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlayAllowSubscribers: e.target.checked
    }),
    style: {
      width: 'auto',
      margin: 0
    }
  }), " Suscriptores"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0,
      alignItems: 'center',
      gap: '4px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!overlays.welcomeOverlayAllowModerators,
    onChange: e => setOverlays({
      ...overlays,
      welcomeOverlayAllowModerators: e.target.checked
    }),
    style: {
      width: 'auto',
      margin: 0
    }
  }), " Moderadores"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: () => handleSaveOverlaysConfigOnly('Bienvenida')
  }, renderIcon('save'), " Guardar Configuraci\xF3n"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-green",
    onClick: () => {
      const iframe = document.getElementById('iframe-welcome');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          action: 'triggerTestAlert',
          payload: {
            type: 'join',
            uniqueId: 'zero_fm',
            user: 'Zero FM',
            profilePic: 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7343292376918818822~tplv-tiktok-shrink:100x100.webp'
          }
        }, '*');
      }
    }
  }, renderIcon('play'), " Simular Entrada"))), activeSub === 'tts' && /*#__PURE__*/React.createElement("div", {
    className: "glass-card animate-fade-in"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '10px'
    }
  }, "\uD83D\uDDE3\uFE0F Lector de Voz (TTS) para Chat y Comentarios"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.88rem',
      marginBottom: '20px'
    }
  }, "Configura la lectura autom\xE1tica en voz alta de los comentarios de tu chat en vivo de TikTok, similar a Tikfinity."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '25px',
      paddingBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: 'var(--accent-primary)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u2699\uFE0F Configuraci\xF3n General")), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "toggle-switch-label",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.chatTtsEnabled,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsEnabled: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '10px'
    }
  }), "Activar Lector de Chat (TTS)")), /*#__PURE__*/React.createElement("div", {
    className: "grid-3",
    style: {
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Idioma de la Voz"), /*#__PURE__*/React.createElement("select", {
    value: overlays.chatTtsLanguage,
    onChange: e => {
      const lang = e.target.value;
      const filtered = voices.filter(v => v.lang.startsWith(lang));
      const firstVoiceName = filtered.length > 0 ? filtered[0].name : 'Default Voice';
      setOverlays({
        ...overlays,
        chatTtsLanguage: lang,
        chatTtsVoice: firstVoiceName
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "es-MX"
  }, "Espa\xF1ol (M\xE9xico) [es-MX]"), /*#__PURE__*/React.createElement("option", {
    value: "es-ES"
  }, "Espa\xF1ol (Espa\xF1a) [es-ES]"), /*#__PURE__*/React.createElement("option", {
    value: "es-US"
  }, "Espa\xF1ol (EE.UU.) [es-US]"), /*#__PURE__*/React.createElement("option", {
    value: "en-US"
  }, "English (US) [en-US]"), /*#__PURE__*/React.createElement("option", {
    value: "en-GB"
  }, "English (UK) [en-GB]"), /*#__PURE__*/React.createElement("option", {
    value: "pt-BR"
  }, "Portugu\xEAs (Brasil) [pt-BR]"), /*#__PURE__*/React.createElement("option", {
    value: "fr-FR"
  }, "Fran\xE7ais (France) [fr-FR]"), /*#__PURE__*/React.createElement("option", {
    value: "it-IT"
  }, "Italiano (Italia) [it-IT]"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Voz Espec\xEDfica"), /*#__PURE__*/React.createElement("select", {
    disabled: overlays.chatTtsRandomVoice,
    value: overlays.chatTtsVoice,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsVoice: e.target.value
    })
  }, voices.filter(v => v.lang.startsWith(overlays.chatTtsLanguage)).map(v => /*#__PURE__*/React.createElement("option", {
    key: v.name,
    value: v.name
  }, v.name, " (", v.lang, ")")), voices.filter(v => v.lang.startsWith(overlays.chatTtsLanguage)).length === 0 && /*#__PURE__*/React.createElement("option", {
    value: "Default Voice"
  }, "Voz del sistema por defecto"))), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "toggle-switch-label",
    style: {
      marginTop: '30px',
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.chatTtsRandomVoice,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsRandomVoice: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Voz Aleatoria (por idioma)"))), /*#__PURE__*/React.createElement("div", {
    className: "grid-3",
    style: {
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Velocidad (Speed): ", overlays.chatTtsSpeed, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "200",
    step: "5",
    value: overlays.chatTtsSpeed,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsSpeed: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Tono (Pitch): ", overlays.chatTtsPitch, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "10",
    max: "200",
    step: "5",
    value: overlays.chatTtsPitch,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsPitch: parseInt(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Volumen: ", overlays.chatTtsVolume, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: overlays.chatTtsVolume,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsVolume: parseInt(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '25px',
      paddingBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: '15px',
      color: 'var(--accent-primary)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDC65 Usuarios Generales Permitidos")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '15px',
      padding: '12px 16px',
      background: 'rgba(0,0,0,0.2)',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.chatTtsAllowAll,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsAllowAll: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Cualquiera (Todos)"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0,
      opacity: overlays.chatTtsAllowAll ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    disabled: overlays.chatTtsAllowAll,
    type: "checkbox",
    checked: overlays.chatTtsAllowAll ? true : overlays.chatTtsAllowSubscribers,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsAllowSubscribers: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Suscriptores \u2B50"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0,
      opacity: overlays.chatTtsAllowAll ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    disabled: overlays.chatTtsAllowAll,
    type: "checkbox",
    checked: overlays.chatTtsAllowAll ? true : overlays.chatTtsAllowModerators,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsAllowModerators: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Moderadores \uD83D\uDEE1\uFE0F"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0,
      opacity: overlays.chatTtsAllowAll ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    disabled: overlays.chatTtsAllowAll,
    type: "checkbox",
    checked: overlays.chatTtsAllowAll ? true : overlays.chatTtsAllowTeam,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsAllowTeam: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Miembros de Equipo/Super Fans \uD83D\uDC65"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0,
      opacity: overlays.chatTtsAllowAll ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    disabled: overlays.chatTtsAllowAll,
    type: "checkbox",
    checked: overlays.chatTtsAllowAll ? true : overlays.chatTtsAllowTopGifters,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsAllowTopGifters: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Top Gifters (Ranking) \uD83C\uDFC6")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.8rem',
      marginTop: '10px'
    }
  }, "\uD83D\uDCA1 Nota: El Streamer/Creador siempre tiene permiso para usar el lector de chat sin importar estos filtros.")), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '25px',
      paddingBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      background: 'rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.05)',
      padding: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--accent-primary)',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\uD83C\uDF1F Special Users")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.82rem',
      marginBottom: '15px'
    }
  }, "Permite o bloquea usuarios espec\xEDficos y as\xEDgnales sus propias voces, velocidades y tonos de lectura personalizados."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Usuario (@handle)",
    value: newSpecialUser.username,
    onChange: e => setNewSpecialUser({
      ...newSpecialUser,
      username: e.target.value
    }),
    style: {
      flex: 1,
      height: '38px',
      fontSize: '0.88rem'
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: addSpecialUser,
    style: {
      height: '38px',
      padding: '0 15px',
      fontSize: '0.88rem'
    }
  }, "\u2795 Agregar")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      marginBottom: '10px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "\uD83D\uDD0D Buscar usuario en la lista...",
    value: specialUserSearch,
    onChange: e => setSpecialUserSearch(e.target.value),
    style: {
      height: '32px',
      fontSize: '0.82rem'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto',
      maxHeight: '250px',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '8px'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.82rem'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: 'rgba(255,255,255,0.03)',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '8px',
      textAlign: 'left'
    }
  }, "Usuario"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '8px',
      textAlign: 'center'
    }
  }, "Permitido"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '8px',
      textAlign: 'left'
    }
  }, "Voz"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '8px',
      textAlign: 'center'
    }
  }, "Vel / Tono"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '8px',
      textAlign: 'center'
    }
  }, "Acci\xF3n"))), /*#__PURE__*/React.createElement("tbody", null, (overlays.chatTtsSpecialUsers || []).filter(u => !specialUserSearch || u.username.toLowerCase().includes(specialUserSearch.toLowerCase())).map(u => /*#__PURE__*/React.createElement("tr", {
    key: u.username,
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.04)'
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px',
      fontWeight: 'bold',
      color: '#fff'
    }
  }, "@", u.username), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: u.allowed,
    onChange: e => updateSpecialUser(u.username, 'allowed', e.target.checked),
    style: {
      width: 'auto'
    }
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px'
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: u.voice,
    disabled: !u.allowed,
    onChange: e => updateSpecialUser(u.username, 'voice', e.target.value),
    style: {
      padding: '4px',
      fontSize: '0.78rem',
      height: '28px',
      minWidth: '100px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "Default Voice"
  }, "Default"), voices.filter(v => v.lang.startsWith(overlays.chatTtsLanguage)).map(v => /*#__PURE__*/React.createElement("option", {
    key: v.name,
    value: v.name
  }, v.name.substring(0, 15), "...")))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '3px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Vel:"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    disabled: !u.allowed,
    min: "10",
    max: "200",
    value: u.speed,
    onChange: e => updateSpecialUser(u.username, 'speed', parseInt(e.target.value) || 50),
    style: {
      width: '42px',
      padding: '2px',
      fontSize: '0.75rem',
      height: '20px'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '3px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Tono:"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    disabled: !u.allowed,
    min: "10",
    max: "200",
    value: u.pitch,
    onChange: e => updateSpecialUser(u.username, 'pitch', parseInt(e.target.value) || 50),
    style: {
      width: '42px',
      padding: '2px',
      fontSize: '0.75rem',
      height: '20px'
    }
  })))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary btn-red",
    onClick: () => deleteSpecialUser(u.username),
    style: {
      padding: '4px 8px',
      fontSize: '0.75rem',
      height: '26px'
    }
  }, "\uD83D\uDDD1\uFE0F")))), (overlays.chatTtsSpecialUsers || []).length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    style: {
      padding: '20px',
      textAlign: 'center',
      color: 'var(--text-secondary)'
    }
  }, "No Special Users defined")))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      background: 'rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.05)',
      padding: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--accent-primary)',
      marginBottom: '10px'
    }
  }, "\uD83D\uDD0A Probar Voz / TTS"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: testerText,
    onChange: e => setTesterText(e.target.value),
    placeholder: "Escribe un mensaje de prueba...",
    style: {
      flex: 1,
      height: '38px',
      fontSize: '0.88rem'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      flex: 1,
      height: '38px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5px'
    },
    onClick: () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(testerText);
        utterance.lang = overlays.chatTtsLanguage;
        utterance.rate = overlays.chatTtsSpeed / 50;
        utterance.pitch = overlays.chatTtsPitch / 50;
        utterance.volume = overlays.chatTtsVolume / 100;
        if (!overlays.chatTtsRandomVoice) {
          const selectedVoice = voices.find(v => v.name === overlays.chatTtsVoice);
          if (selectedVoice) utterance.voice = selectedVoice;
        } else {
          const filtered = voices.filter(v => v.lang.startsWith(overlays.chatTtsLanguage));
          if (filtered.length > 0) {
            utterance.voice = filtered[Math.floor(Math.random() * filtered.length)];
          }
        }
        window.speechSynthesis.speak(utterance);
      }
    }
  }, "\uD83D\uDD0A Probar Voz Local"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      flex: 1,
      height: '38px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5px',
      color: '#a855f7',
      borderColor: '#a855f7'
    },
    onClick: () => triggerOverlayTest('chat', testerText.trim() || undefined)
  }, "\uD83E\uDDEA Probar TTS en Overlay")))), /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      background: 'rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.05)',
      padding: '20px',
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--accent-primary)',
      marginBottom: '10px'
    }
  }, "TTS Logs"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '8px',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '0.8rem',
      maxHeight: '160px',
      overflowY: 'auto',
      color: 'var(--text-secondary)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    }
  }, ttsLogs.slice().reverse().map((log, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      paddingBottom: '3px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent-primary)'
    }
  }, "[", log.timestamp, "]"), ' ', /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontWeight: 'bold'
    }
  }, log.user, ":"), ' ', /*#__PURE__*/React.createElement("span", null, log.message))), ttsLogs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '20px',
      fontStyle: 'italic'
    }
  }, "No hay logs de TTS recientes"))))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '25px',
      paddingBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      background: 'rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.05)',
      padding: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--accent-primary)',
      marginBottom: '15px'
    }
  }, "Spam Protection"), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginBottom: '12px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "User Cooldown (seconds)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: "3600",
    value: overlays.chatTtsUserCooldown,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsUserCooldown: parseInt(e.target.value) || 0
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginBottom: '12px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Max Queue Length"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "50",
    value: overlays.chatTtsMaxQueueLength,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsMaxQueueLength: parseInt(e.target.value) || 5
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginBottom: '12px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Max Comment Length"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "10",
    max: "1000",
    value: overlays.chatTtsMaxCommentLength,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsMaxCommentLength: parseInt(e.target.value) || 300
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginTop: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.chatTtsFilterLetterSpam,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsFilterLetterSpam: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Filter Letter Spam (ej. aaaaa -> aa)"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.chatTtsFilterMentions,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsFilterMentions: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Filter @mentions (remueve menciones)"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.chatTtsFilterCommands,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsFilterCommands: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Filter !commands (remueve palabras con prefijo !)"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      background: 'rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.05)',
      padding: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--accent-primary)',
      marginBottom: '15px'
    }
  }, "Advanced"), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginBottom: '12px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Message Template"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: overlays.chatTtsMessageTemplate,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsMessageTemplate: e.target.value
    }),
    placeholder: "{nickname} dice {comment}"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.78rem',
      color: 'var(--text-secondary)',
      lineHeight: '1.4'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 'bold',
      color: '#fff'
    }
  }, "Placeholder Params:"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", null, "{nickname}"), ": Nombre de pantalla de TikTok", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", null, "{username}"), ": ID de usuario (@handle)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", null, "{comment}"), ": Mensaje de chat limpio", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'italic',
      display: 'block',
      marginTop: '5px'
    }
  }, "Ejemplo: ", /*#__PURE__*/React.createElement("code", null, "{nickname} dice {comment}")))), /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      background: 'rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.05)',
      padding: '20px',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--accent-primary)',
      marginBottom: '10px'
    }
  }, "\uD83D\uDCAC Filtro de Tipo de Comentario"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "chatTtsType",
    checked: overlays.chatTtsType === 'any',
    onChange: () => setOverlays({
      ...overlays,
      chatTtsType: 'any'
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Cualquier comentario (excluye comandos)"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "chatTtsType",
    checked: overlays.chatTtsType === 'dot',
    onChange: () => setOverlays({
      ...overlays,
      chatTtsType: 'dot'
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Comienza con punto (ej. ", /*#__PURE__*/React.createElement("code", null, ".hola"), ")"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "chatTtsType",
    checked: overlays.chatTtsType === 'slash',
    onChange: () => setOverlays({
      ...overlays,
      chatTtsType: 'slash'
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Comienza con diagonal (ej. ", /*#__PURE__*/React.createElement("code", null, "/saludos"), ")"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "chatTtsType",
    checked: overlays.chatTtsType === 'command',
    onChange: () => setOverlays({
      ...overlays,
      chatTtsType: 'command'
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), "Comienza con Comando Personalizado"), overlays.chatTtsType === 'command' && /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      margin: '5px 0 0 20px',
      maxWidth: '200px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: overlays.chatTtsCommand,
    placeholder: "ej. !tts",
    onChange: e => setOverlays({
      ...overlays,
      chatTtsCommand: e.target.value
    }),
    style: {
      height: '30px',
      fontSize: '0.8rem'
    }
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "glass-card",
    style: {
      background: 'rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.05)',
      padding: '20px',
      marginBottom: '25px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--accent-primary)',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\uD83E\uDE99 Sistema de Cobro por Puntos")), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginBottom: '15px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "toggle-switch-label",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlays.chatTtsChargePoints,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsChargePoints: e.target.checked
    }),
    style: {
      width: 'auto',
      marginRight: '10px'
    }
  }), "Cobrar puntos por lectura de voz (TTS)")), overlays.chatTtsChargePoints && /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      maxWidth: '200px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Costo en Puntos por Mensaje"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "1000",
    value: overlays.chatTtsCost,
    onChange: e => setOverlays({
      ...overlays,
      chatTtsCost: parseInt(e.target.value) || 5
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: () => handleSaveOverlaysConfigOnly('Chat TTS')
  }, renderIcon('save'), " Guardar Configuraci\xF3n"))))), activeTab === 'prueba' && /*#__PURE__*/React.createElement("div", {
    className: "grid-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83E\uDDEA Prueba Offline (Song Request Simulator)"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Modo de Simulaci\xF3n"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '15px',
      padding: '6px 0'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    checked: offlineTest.mode === 'manual',
    onChange: () => setOfflineTest({
      ...offlineTest,
      mode: 'manual'
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), " Manual (Exacta)"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      cursor: 'pointer',
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    checked: offlineTest.mode === 'search',
    onChange: () => setOfflineTest({
      ...offlineTest,
      mode: 'search'
    }),
    style: {
      width: 'auto',
      marginRight: '8px'
    }
  }), " iTunes / B\xFAsqueda chat"))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Nombre Espectador"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: offlineTest.user,
    onChange: e => setOfflineTest({
      ...offlineTest,
      user: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Apple Music ID (Opcional)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "1647492502",
    value: offlineTest.appleMusicId,
    onChange: e => setOfflineTest({
      ...offlineTest,
      appleMusicId: e.target.value
    })
  }))), offlineTest.mode === 'manual' ? /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Artista"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Bad Bunny",
    value: offlineTest.artist,
    onChange: e => setOfflineTest({
      ...offlineTest,
      artist: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Canci\xF3n"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "MONACO",
    value: offlineTest.song,
    onChange: e => setOfflineTest({
      ...offlineTest,
      song: e.target.value
    })
  }))) : /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Mensaje de Chat (!sr + b\xFAsqueda)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "!sr bad bunny titi me pregunto",
    value: offlineTest.message,
    onChange: e => setOfflineTest({
      ...offlineTest,
      message: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row"
  }, /*#__PURE__*/React.createElement("span", null, "Enviar directamente a Cider"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: offlineTest.sendToCider,
    onChange: e => setOfflineTest({
      ...offlineTest,
      sendToCider: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row"
  }, /*#__PURE__*/React.createElement("span", null, "Guardar en Lista de Espera (Cola)"), /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: offlineTest.sendToQueue,
    onChange: e => setOfflineTest({
      ...offlineTest,
      sendToQueue: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    style: {
      width: '100%',
      marginTop: '20px'
    },
    onClick: handleSendOfflineTest
  }, "\uD83D\uDE80 Enviar Prueba"), /*#__PURE__*/React.createElement("div", {
    className: "result-box"
  }, offlineTest.resultText || 'Esperando simulador...')), /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83E\uDDEA Mock Cider (Controles Integrados)"), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Cider Player Local URL"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: config.ciderUrl,
    onChange: e => setConfig({
      ...config,
      ciderUrl: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "toggle-row",
    style: {
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement("span", null, "Acci\xF3n Mock Cider Server"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: '8px 16px',
      fontSize: '0.85rem'
    },
    onClick: () => handleMockCiderAction('start')
  }, "Iniciar"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: '8px 16px',
      fontSize: '0.85rem',
      background: 'rgba(239,68,68,0.1)',
      borderColor: 'rgba(239,68,68,0.2)',
      color: 'var(--error)'
    },
    onClick: () => handleMockCiderAction('stop')
  }, "Detener"))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Requester (Usuario)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: mockCider.requester,
    onChange: e => setMockCider({
      ...mockCider,
      requester: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Apple Music ID"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "1647492502",
    value: mockCider.appleMusicId,
    onChange: e => setMockCider({
      ...mockCider,
      appleMusicId: e.target.value
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Artista"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: mockCider.artist,
    onChange: e => setMockCider({
      ...mockCider,
      artist: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Canci\xF3n"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: mockCider.song,
    onChange: e => setMockCider({
      ...mockCider,
      song: e.target.value
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    style: {
      padding: '10px 14px',
      fontSize: '0.88rem'
    },
    onClick: () => handleMockCiderAction('emit', true)
  }, "\uD83C\uDFB5 Emitir Now Playing"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: '10px 14px',
      fontSize: '0.88rem'
    },
    onClick: () => handleMockCiderAction('play-next')
  }, "\u23ED\uFE0F Play Next"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: '10px 14px',
      fontSize: '0.88rem'
    },
    onClick: () => handleMockCiderAction('clear')
  }, "\uD83E\uDDF9 Limpiar Cola")), /*#__PURE__*/React.createElement("div", {
    className: "result-box"
  }, mockCider.resultText || 'Mock inactivo...')), /*#__PURE__*/React.createElement("div", {
    className: "glass-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '15px'
    }
  }, "\uD83C\uDF81 Simulador de Regalos (Timer & Alertas)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.82rem',
      marginBottom: '15px',
      lineHeight: '1.4'
    }
  }, "Simula eventos de regalos en tu directo de TikTok para testear la extensi\xF3n de tiempo en el overlay del Timer y las Alertas Premium."), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Nombre Donador"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: giftTest.user,
    onChange: e => setGiftTest({
      ...giftTest,
      user: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group",
    style: {
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("label", null, "Regalo de TikTok"), /*#__PURE__*/React.createElement("select", {
    value: giftTest.giftName,
    onChange: e => {
      const gift = e.target.value;
      let coins = 1;
      if (gift === 'TikTok León') coins = 2999;else if (gift === 'Caja del Tesoro') coins = 1000;else if (gift === 'Confeti') coins = 100;else if (gift === 'TikTok Rose') coins = 1;
      setGiftTest({
        ...giftTest,
        giftName: gift,
        coins: coins
      });
    },
    style: {
      width: '100%',
      background: 'rgba(0, 0, 0, 0.4)',
      border: '1px solid var(--border-glass)',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      outline: 'none',
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "TikTok Rose"
  }, "TikTok Rose (1 Moneda)"), /*#__PURE__*/React.createElement("option", {
    value: "Confeti"
  }, "Confeti (100 Monedas)"), /*#__PURE__*/React.createElement("option", {
    value: "Caja del Tesoro"
  }, "Caja del Tesoro (1000 Monedas)"), /*#__PURE__*/React.createElement("option", {
    value: "TikTok Le\xF3n"
  }, "TikTok Le\xF3n (2999 Monedas)"))), /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      marginTop: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Monedas (Valor)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: giftTest.coins,
    onChange: e => setGiftTest({
      ...giftTest,
      coins: parseInt(e.target.value) || 1
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Segundos a Sumar (Opcional)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    placeholder: `Por defecto (${config.secondsPerGift || 30}s)`,
    value: giftTest.seconds,
    onChange: e => setGiftTest({
      ...giftTest,
      seconds: e.target.value
    })
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-green",
    style: {
      width: '100%',
      marginTop: '20px'
    },
    onClick: handleSendGiftTest
  }, "\uD83C\uDF81 Enviar Regalo de Prueba"), /*#__PURE__*/React.createElement("div", {
    className: "result-box",
    style: {
      minHeight: '80px',
      whiteSpace: 'pre-line'
    }
  }, giftTest.resultText || 'Esperando simulación...'))), /*#__PURE__*/React.createElement("div", {
    className: `floating-save-bar ${showSaveBar ? 'show' : ''}`
  }, isConfigDirty || Object.keys(dirtyKeys).length > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, renderIcon('info', 16), "Ediciones pendientes del bot en vivo", /*#__PURE__*/React.createElement("span", {
    className: `save-badge ${saveStatus ? 'show' : ''}`
  }, saveStatus)), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: handleSaveGlobalConfig
  }, renderIcon('save'), " Guardar Cambios")) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontSize: '0.95rem',
      fontWeight: '600',
      color: 'white'
    }
  }, /*#__PURE__*/React.createElement("span", null, saveStatus))));
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));

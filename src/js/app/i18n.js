// app/i18n.js — 영어 지원: 화면에 그려진 글자를 문장 단위로 바꿔 줌 (게임 코드는 한국어 그대로)
//   · 언어: localStorage badminton.lang ('ko' 기본 · 'en'). 대기화면 제목 옆 버튼으로 전환(새로고침)
//   · 방식: 글자 조각(텍스트 노드)마다 ① 통째로 사전(EX) ② 규칙(RX) ③ ' · ' ' — ' ' / ' 로 나눠 각각 ④ "A (B)"·"A 숫자"·단위 규칙
//     → 한 조각이 전부 옮겨질 때만 바꿈. 하나라도 모르는 말이 있으면 그 조각은 한국어 그대로 (한글·영어가 섞이지 않게)
//   · 3D 본편 기준. 레트로 모드와 README는 한국어. 사용자 닉네임 등 사전에 없는 말은 그대로
//   · 긴 글 튜토리얼은 TUTORIAL_3D_PAGES_EN을 따로 둠 (main.js가 언어에 따라 고름)
//   새 문구를 추가하면 여기 EX(또는 RX)에도 넣을 것. 빠진 문구는 I18N.missing()으로 확인

const I18N = {
  KEY: 'badminton.lang', lang: 'ko', cache: new Map(), miss: new Set(), HAN: /[가-힣]/,
  EX: {
    // ── 대기화면 ──
    '배드민턴 랠리': 'Badminton Rally',
    '실제 코트 규격과 단식 규칙으로 치는 3D 배드민턴 — 설치 없이 브라우저에서 바로.': '3D badminton on a regulation court with real singles rules — right in your browser, no install.',
    '게임 종류': 'Game', '대전 모드': 'Mode', 'AI 대전 설정': 'AI match settings', '대전 설정': 'Match settings', '커리어 설정': 'Career settings', '일일 챌린지 설정': 'Daily challenge settings', '빠른 대전 설정': 'Quick match settings',
    '난이도': 'Difficulty', '쉬움': 'Easy', '중간': 'Normal', '어려움': 'Hard', '지옥': 'Hell', '임파서블': 'Impossible',
    '상대 성향': 'Opponent style', '기본': 'Default', '수비형': 'Defender', '네트형': 'Net player', '스매시형': 'Smasher',
    '목표 점수': 'Play to', '주 손': 'Hand', '오른손': 'Right', '왼손': 'Left',
    '친선게임': 'Friendly', '빠른 대전': 'Quick match', '커리어': 'Career', '일일 챌린지': 'Daily challenge', '훈련': 'Training', 'AI 대전': 'vs AI', '랭크전': 'Ranked', '복식': 'Doubles', '레트로 모드': 'Retro mode', '3D 코트': '3D Court',
    '인터넷 필요 · 한 명이 방을 만들고, 친구는 그 코드로 입장 · 둘 다 같은 게임 종류를 골라야 해요 · 목표 점수는 방장 설정': 'Needs internet · one player creates a room, the friend joins with its code · both must pick the same game · the host sets the target score',
    '닉네임': 'Nickname', '한 번 적으면 다음 판에도 그대로 남아 있어요': 'Saved for next time', '방 만들기': 'Create room', '또는': 'or', '입장': 'Join',
    '인터넷 필요 · 매칭 점수가 비슷한 사람을 자동으로 찾아요 · 11점 경기 · 채·선수 스탯 효과 없이 같은 조건': 'Needs internet · finds a player with a similar rating automatically · first to 11 · no racket or player-stat effects, equal conditions',
    '커리어 — 대회를 차례로 우승': 'Career — win each tournament in turn', '이기면 다음 상대 · 지면 그 경기만 재도전 · 훈련 레벨 효과 적용': 'Win to unlock the next opponent · lose and retry just that match · training levels apply',
    '처음부터 다시': 'Start over', '내 채': 'My racket', '코인으로 구매·강화 · 강화할수록 장단점이 함께 커짐 · 효과는 AI 대전·커리어에만 적용': 'Buy and upgrade with coins · upgrades grow both the upside and the downside · effects apply in vs AI and Career only',
    '내 선수': 'My player', '경기·훈련으로 레벨 업 → 레벨마다 스탯 포인트 1 · 다시 나누기 무료 · 효과는 AI 대전·커리어에만 적용': 'Level up by playing and training → 1 stat point per level · free to redistribute · effects apply in vs AI and Career only',
    '꾸미기': 'Customize', '코인으로 구매 · 겉모습만 바뀜(능력치 없음) · 친선게임에서 상대에게도 유니폼·채 색이 보여요': 'Buy with coins · looks only (no stats) · opponents see your kit and racket color in online matches',
    '날마다 종목이 바뀜 · 누구에게나 같은 공 15개 · 여러 번 도전, 최고 점수만 인정': 'A new drill every day · the same 15 shuttles for everyone · retry freely, best score counts',
    '훈련 — 선수 키우기': 'Training — build your player', '연속 성공으로 레벨업 · 레벨 효과는 AI 대전에 적용': 'Level up with streaks · level effects apply in vs AI',
    '직접 해 보기': 'Try it', '30초': '30s', '튜토리얼': 'Tutorial', '시작': 'Start', '← 메뉴': '← Menu', '방': 'Room', '상대': 'Opp', '서브': 'Serve', '나': 'Me', '랠리': 'Rally', '최근 샷': 'Last shot', '설정': 'Setup',
    '💪 체력 켬': '💪 Stamina on', '💪 체력 무한': '💪 Stamina ∞', '📍 낙하 표시 켬': '📍 Landing on', '📍 낙하 표시 끔': '📍 Landing off', '🌑 그림자 켬': '🌑 Shadow on', '🌑 그림자 끔': '🌑 Shadow off', '🔊 소리': '🔊 Sound', '🔇 소리': '🔇 Sound',
    '다시 시작': 'Restart', '이동': 'Move', '튜토리얼 건너뛰기 ›': 'Skip tutorial ›', '▶ 마지막 랠리 다시 보기': '▶ Replay last rally', '■ 리플레이 끝내기': '■ Stop replay', '📸 결과 카드 저장 · 공유': '📸 Save / share result card',
    '체력': 'Stamina', '런지': 'Lunge', '방향': 'Aim', '올리기': 'Lift', '찍기': 'Smash', '직선': 'Flat', '클릭': 'Click', '점프': 'Jump', 'Q · 서브': 'Q · Serve',
    'WASD 이동 · 마우스 = 치는 방향(커서 쪽)': 'WASD to move · mouse = shot direction (toward the cursor)',
    'Q 올리기 · E 찍기 · 좌클릭 직선 — 꾹 눌러 충전, 떼면 스윙': 'Q lift · E smash · left click flat — hold to charge, release to swing',
    'Space 점프 · Shift 런지(셔틀 쪽으로 크게 한 발)': 'Space jump · Shift lunge (a big step toward the shuttle)',
    'T 꾹 = 감정표현 (마우스로 고르고 떼기)': 'Hold T = emotes (pick with the mouse, release)',
    '이전': 'Back', '닫기': 'Close', '다음': 'Next', '로그인': 'Log in', '회원가입': 'Sign up', '이메일': 'Email', '비밀번호': 'Password', '6자 이상': '6+ characters', '2~16자 · 다른 사람과 겹치면 안 돼요': '2–16 characters · must be unique',
    '상대에게 보일 이름': 'Name shown to opponents', '방 코드 5자리': '5-letter code', '메뉴로': 'Back to menu', '클릭하면 코드 복사': 'Click to copy the code', '친선게임 방 설정: 체력 켬 / 무한 (둘 다 적용)': 'Room setting: stamina on / infinite (applies to both)', '이동 패드': 'Move pad', '감정표현': 'Emotes',
    '실제 규격 코트와 단식 규칙. WASD로 움직이고 마우스로 방향을 잡아, 셔틀이 라켓에 닿는 순간 스윙.': 'Regulation court, real singles rules. Move with WASD, aim with the mouse, and swing as the shuttle reaches your racket.',
    '본편': 'Main', '이 게임의 첫 버전. 옆에서 보는 2D 코트에서 키보드로 샷을 골라 칩니다.': 'The original version: a side-view 2D court where you pick shots on the keyboard.', '2D 클래식': '2D classic',
    '난이도 5단계': '5 difficulty levels', '대회 4개 · 성향이 다른 상대 12명': '4 tournaments · 12 opponents with different styles', '오늘의 종목 · 점수 순위': "Today's drill · score ranking", '선수 키우기 · 근력/순발력/판단력': 'Build your player · power / agility / judgment',
    '비슷한 실력과 자동 매칭': 'Auto-match with similar skill', '방 코드로 온라인 대전': 'Online match by room code', '구글 로그인 · 레이팅': 'Google login · rating', '2 대 2': '2 vs 2', '준비 중': 'Coming soon',
    '커리어 진행을 처음으로 되돌릴까요? (훈련 레벨은 그대로)': 'Reset career progress? (Training levels are kept)',
    '아직 도전하지 않았어요': 'Not attempted yet', '순위표를 불러오는 중…': 'Loading leaderboard…', '순위표는 아직 준비 중이에요. 내 최고 기록은 이 브라우저에 저장됩니다.': 'The leaderboard is not ready yet. Your best score is saved in this browser.',
    '순위표를 불러오지 못했어요 (인터넷 연결 확인).': 'Could not load the leaderboard (check your connection).', '아직 기록이 없어요 — 첫 번째로 올려 보세요!': 'No scores yet — be the first!', '로그인하면 내 점수도 순위표에 올라가요.': 'Log in to put your score on the leaderboard.',
    '순위표는 아직 준비 중이에요. 매칭은 그대로 됩니다.': 'The leaderboard is not ready yet. Matchmaking still works.', '로그인하면 내 매칭 점수도 순위표에 올라가요.': 'Log in to put your rating on the leaderboard.',
    '오늘의 순위': "Today's ranking", '상위 10명': 'Top 10', '매칭 점수 순위': 'Rating leaderboard', '상위 10명 · 빠른 대전을 1경기 이상 한 사람': 'Top 10 · players with at least 1 quick match', '모든 대회 우승!': 'All tournaments won!',
    '장착 중': 'Equipped', '보유': 'Owned', '사용 중': 'In use', '장착': 'Equip', '최고 레벨': 'Max level', '최대 레벨': 'Max level', '효과 없음': 'No effect', '없음': 'None', '남은 포인트': 'Points left',
    '입장 전에 닉네임을 적어 주세요.': 'Enter a nickname before joining.', '방 코드는 5자리예요.': 'Room codes have 5 characters.',
    '3D를 시작할 수 없어요 (WebGL 미지원 브라우저일 수 있음).': 'Could not start 3D (your browser may not support WebGL).', '게스트': 'Guest', '방을 만드는 중…': 'Creating room…', '연결하는 중…': 'Connecting…', '상대를 찾았어요!': 'Opponent found!',
    '방 코드': 'Room code', '친구에게 이 코드를 알려주세요 — 들어오면 바로 시작합니다': 'Share this code with your friend — the match starts when they join', '오래 걸리면 코드를 다시 확인해 주세요': 'If this takes long, double-check the code',
    // ── 계정 ──
    '닉네임은 2~16자로 정해주세요.': 'Nickname must be 2–16 characters.', '이미 쓰고 있는 닉네임이에요.': 'That nickname is taken.', '이메일 또는 비밀번호가 맞지 않아요.': 'Wrong email or password.', '이미 가입된 이메일이에요. 로그인해 주세요.': 'That email is already registered. Please log in.',
    '비밀번호는 6자 이상이어야 해요.': 'Password must be at least 6 characters.', '메일 인증이 아직 안 됐어요. 받은편지함의 인증 링크를 눌러주세요.': 'Email not confirmed yet. Click the link in your inbox.', '이메일 형식을 확인해 주세요.': 'Check the email format.',
    '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.': 'Too many requests. Try again shortly.', '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.': 'Cannot reach the server. Check your connection.', '온라인 서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.': 'Cannot reach the online server. Check your connection.',
    '계정 기능을 불러오지 못했어요 — 게스트로 플레이 (기록은 이 브라우저에만 저장)': 'Account features failed to load — playing as guest (records stay in this browser)', '내 기록': 'My records', '계정 확인 중…': 'Checking account…',
    '게스트 — 기록은 이 브라우저에만 저장돼요': 'Guest — records are saved in this browser only', '로그인 / 회원가입': 'Log in / Sign up', '· 기록이 계정에 저장돼요': '· records are saved to your account', '로그아웃': 'Log out', '가입하기': 'Sign up', '처리 중…': 'Working…',
    '가입 완료! 메일로 온 인증 링크를 누른 뒤 로그인해 주세요.': 'Signed up! Click the confirmation link in your email, then log in.', '가입 완료! 로그인됐어요.': 'Signed up and logged in!',
    '코인': 'Coins', '지금까지 번 코인': 'Total earned', '서버 저장 준비 중 — 지금은 이 브라우저에만 저장돼요': 'Server storage not ready — saved in this browser for now', '계정에 저장돼요': 'Saved to your account', '이 브라우저에 저장 — 로그인하면 계정으로 옮겨져요': 'Saved in this browser — moves to your account when you log in',
    'AI 대전 승리': 'vs AI win', '패배': 'Loss', '오늘의 첫 승': 'First win of the day', '긴 랠리': 'Long rally', '훈련 레벨업': 'Training level-up', '(오늘 받음)': '(claimed today)', '(경기당 한 번)': '(once per match)',
    '끝까지 한 경기만 받을 수 있어요 · 쓰는 곳: 대기화면의 「내 채」(AI 대전·커리어)와 「꾸미기」': 'Only finished matches pay out · spend them in "My racket" (vs AI / Career) and "Customize" on the menu',
    '최근 내역': 'Recent', '불러오는 중…': 'Loading…', '승률': 'Win rate', '계정에 저장된 기록 (AI 대전만 · 최근 10경기)': 'Records in your account (vs AI only · last 10)', '이 브라우저에 저장된 AI 대전 기록 (최근 10경기 표시)': 'vs AI records in this browser (last 10)',
    '아직 AI 대전 기록이 없어요. AI 대전을 끝까지 해보세요!': 'No vs AI records yet. Finish a match against the AI!', '친구': 'Friend', '레트로': 'Retro', '승': 'W', '패': 'L', '전': 'played', '선수': 'Player',
    // ── 경기 화면 ──
    '매치 포인트': 'Match point', '상대 매치 포인트': 'Opponent match point', '매치 포인트!': 'Match point!', '연속': 'Streak', '목표': 'Goal', '(최대)': '(max)', '점수': 'Score', '남은 공': 'Shuttles left', '단계': 'Step', '전체': 'All', '세트': 'Sets',
    '— 네트!': '— Net!', '— 아웃!': '— Out!', '포핸드': 'Forehand', '백핸드': 'Backhand', '라운드 더 헤드': 'Round the head', '머리 위': 'overhead', '옆': 'side', '아래': 'low',
    '상대 서브': 'Opponent serving', '셔틀 그림자 켬': 'Shuttle shadow on', '셔틀 그림자 끔 — 인/아웃은 눈으로!': 'Shuttle shadow off — judge in/out by eye!', '체력 켬': 'Stamina on', '체력 무한': 'Stamina infinite', '낙하 지점 표시 켬': 'Landing marker on', '낙하 지점 표시 끔': 'Landing marker off',
    '상대방이 다시 참여했습니다': 'Opponent rejoined', '경기에 다시 참여했습니다': 'You rejoined the match', '상대방이 나갔습니다': 'Opponent left', '곧 시작합니다…': 'Starting soon…', 'Esc = 메뉴': 'Esc = menu', 'Esc = 메뉴 (빠른 대전을 다시 누르면 새 상대를 찾아요)': 'Esc = menu (start Quick match again to find a new opponent)',
    '네트!': 'Net!', '범실': 'Fault', '서브 에이스!': 'Service ace!', '서브 폴트 (서비스 코트 밖)': 'Service fault (outside the service court)', '득점': 'Point', '아웃': 'Out', '득점!': 'Point!', '실점': 'Point lost', '네트': 'Net',
    '득점! 네트!': 'Point! Net!', '득점! 범실': 'Point! Opponent fault', '득점! 아웃': 'Point! Out', '득점! 서브 에이스!': 'Point! Service ace!', '득점! 서브 폴트 (서비스 코트 밖)': 'Point! Service fault',
    '코트 체인지!': 'Change of ends!', '듀스!': 'Deuce!', '결과 카드를 저장했어요 (다운로드 폴더)': 'Result card saved (Downloads folder)', '결과 카드 공유': 'Result card shared', '결과 카드를 만들지 못했어요': 'Could not create the result card',
    '모든 대회를 우승했습니다 — 커리어 완주!': 'You won every tournament — career complete!', '다시 한번 정상에 섰습니다': 'On top once again', '▶ 마지막 랠리 리플레이 — 버튼을 다시 누르면 끝': '▶ Last rally replay — press the button again to stop',
    '헛스윙! 풀차징은 정확한 타이밍에만': 'Whiff! Full charge needs exact timing', '체력 부족 — 런지 불가': 'Not enough stamina — cannot lunge', '승리!': 'Win!', '패배...': 'Lost...', '승리': 'Win', '첫 승리': 'First win', '대회 우승': 'Tournament win', '참가': 'Played', '레벨업': 'Level up', '오늘 첫 도전': 'First try today',
    'Enter 또는 다시 시작 = 재대결': 'Enter or Restart = rematch', 'Enter 또는 다시 시작 = 재대결 (둘 중 누가 눌러도 함께 시작)': 'Enter or Restart = rematch (either player can start it)', 'Enter 또는 다시 시작 = 재도전': 'Enter or Restart = retry', 'Enter 또는 다시 시작 = 다음 경기': 'Enter or Restart = next match',
    'Enter 또는 다시 시작 = 다음 경기 (둘 중 누가 눌러도 함께 시작)': 'Enter or Restart = next match (either player can start it)', 'Enter 또는 다시 시작 = 결승 다시 하기': 'Enter or Restart = replay the final', 'Enter 또는 다시 시작 = 다시 도전': 'Enter or Restart = try again',
    // ── 샷·훈련·튜토리얼 ──
    '숏 서브': 'Short serve', '롱 서브': 'Long serve', '헤어핀': 'Hairpin', '리프트': 'Lift', '클리어': 'Clear', '드롭': 'Drop', '점프 스매시': 'Jump smash', '스매시': 'Smash', '푸시': 'Push', '드라이브': 'Drive',
    '피딩 · 리프트': 'Feed · lift', '피딩 · 스매시': 'Feed · smash', '피딩': 'Feed', '아웃 공을 건드렸어요': 'You touched an out shuttle', '못 쳤어요': 'Missed', '스매시가 아니에요 (E를 길게)': 'Not a smash (hold E longer)', '표적 명중!': 'On target!', '표적 밖': 'Off target',
    '못 받았어요': 'Not returned', '받아냈다!': 'Returned!', '아웃 공이었어요': 'That one was out', '아웃 판단 정확!': 'Good leave — it was out!', '인 공이었어요': 'That one was in', '인 판단 + 리턴 성공!': 'Good call + returned!', '리턴 아웃': 'Return went out', '연속 끊김': 'streak broken',
    '오늘 내 최고 기록!': 'Your best today!', '근력 훈련 — 높은 공을 E(길게)로 스매시해 노란 표적에 꽂기': 'Power drill — smash high shuttles (hold E) into the yellow target', '순발력 훈련 — 상대 스매시를 받아 넘기기': 'Agility drill — return the opponent\'s smashes', '판단력 훈련 — 아웃은 보내고, 인은 받아 넘기기': 'Judgment drill — leave the outs, return the ins',
    'W A S D로 노란 칸까지 걸어가 보세요': 'Walk to the yellow square with W A S D', '왼쪽 패드로 노란 칸까지 걸어가 보세요': 'Walk to the yellow square with the left pad',
    'Q를 누르고 있다가, 셔틀이 몸 가까이 와서 화면이 느려지면 떼세요': 'Hold Q, and release when the shuttle gets close and time slows down', '올리기를 누르고 있다가, 셔틀이 몸 가까이 와서 화면이 느려지면 떼세요': 'Hold Lift, and release when the shuttle gets close and time slows down',
    '높이 뜬 공이 옵니다. E를 누르고 있다가 셔틀이 머리 위로 오면 떼세요': 'A high one is coming. Hold E and release when the shuttle is above your head', '높이 뜬 공이 옵니다. 찍기를 누르고 있다가 셔틀이 머리 위로 오면 떼세요': 'A high one is coming. Hold Smash and release when the shuttle is above your head',
    '높은 공이 옵니다. Space로 뛰어오른 다음 E(찍기)로 쳐 보세요 — 점프 스매시': 'A high one is coming. Jump with Space, then hit with E — a jump smash', '높은 공이 옵니다. 점프를 누르고 뛰어오른 다음 찍기로 쳐 보세요 — 점프 스매시': 'A high one is coming. Tap Jump, then hit with Smash — a jump smash',
    '먼 공이 옵니다. Shift를 누르면 셔틀 쪽으로 크게 한 발 — 런지하고 Q(올리기)로 받아 보세요': 'A wide one is coming. Shift takes a big step toward the shuttle — lunge and return it with Q', '먼 공이 옵니다. 런지를 누르면 셔틀 쪽으로 크게 한 발 — 런지하고 올리기로 받아 보세요': 'A wide one is coming. Lunge takes a big step toward the shuttle — lunge and return it with Lift',
    'Q를 꾹 누르면 게이지가 왕복합니다. 가운데쯤에서 떼세요 (마우스 = 방향)': 'Hold Q and the gauge swings back and forth. Release near the middle (mouse = direction)', '올리기를 꾹 누르면 게이지가 왕복합니다. 가운데쯤에서 떼세요': 'Hold Lift and the gauge swings back and forth. Release near the middle',
    '완료': 'Done', '좋아요!': 'Nice!', '한 번 더': 'One more', '네트 — 조금 더 세게': 'Net — a bit harder', '서브 성공!': 'Good serve!', '서비스 코트 밖 — 게이지 가운데쯤에서': 'Outside the service court — release near the middle', '놓쳤어요 — 누르고 있다가, 닿을 때 떼기': 'Missed — hold, then release on contact',
    '이번엔 Space(점프)로 뛰어서!': 'This time jump with Space!', '이번엔 점프로 뛰어서!': 'This time use Jump!', '이번엔 Shift(런지)를 써서!': 'This time use Shift (lunge)!', '이번엔 런지를 써서!': 'This time use Lunge!', '이번엔 Q(올리기)로!': 'This time with Q (lift)!', '이번엔 올리기로!': 'This time with Lift!', '이번엔 E(찍기)로!': 'This time with E (smash)!', '이번엔 찍기로!': 'This time with Smash!',
    '네트 — 충전을 조금만': 'Net — charge a little less', '네트 — 한 번 더': 'Net — once more', '맞혔어요! (길어서 아웃 — 충전은 짧게)': 'You hit it! (long, so out — charge less)', '괜찮아요 — 다음 단계로 넘어갈게요': "That's fine — moving on", '튜토리얼 완료!': 'Tutorial complete!', '곧 경기를 시작합니다…': 'The match starts soon…',
    '좌클릭 직선 샷 · T 감정표현도 있어요 (자세한 건 튜토리얼 버튼)': 'There is also left click for flat shots and T for emotes (see the Tutorial button)', '= 경기 시작 · Esc = 메뉴': '= start the match · Esc = menu',
    '연결 시간 초과': 'Connection timed out', '방이 꽉 찼어요 (1:1 방).': 'The room is full (1 v 1).', '같은 코드의 방이 이미 있어요. 다시 만들어 주세요.': 'A room with this code already exists. Create a new one.', '상대도 입장하는 쪽이에요. 한 명은 방 만들기를 눌러야 해요.': 'Your opponent is also joining. One of you must create the room.',
    // ── 성장 ──
    '근력': 'Power', '스매시 노가다': 'Smash grind', '순발력': 'Agility', '스매시 받기': 'Smash defense', '판단력': 'Judgment', '인/아웃 판단': 'In/out calls',
    '높게 올라오는 공을': 'Hit the high feeds with', 'E 스매시': 'E smash', '로 상대 코트의': 'into the', '노란 표적': 'yellow target', '안에 연속으로 꽂으세요.': "on the opponent's court, several in a row.",
    '상대가 계속': 'The opponent keeps hitting', '를 꽂습니다. 연속으로': 'es. Return them', '상대 코트 안으로': "into the opponent's court", '받아 넘기세요.': 'several times in a row.',
    '라인 근처로 오는 공을 판단하세요.': 'Judge shuttles landing near the lines.', '아웃 공은 건드리지 말고': 'Leave the outs', '인 공은 받아 넘기기': 'return the ins', '. 낙하 지점 표시는 없습니다.': '. No landing marker.',
    '8강': 'Quarterfinal', '준결승': 'Semifinal', '결승': 'Final', '동네 대회': 'Local Open', '시 대회': 'City Open', '전국 대회': 'National Open', '세계 대회': 'World Open',
    '한도윤': 'Han Doyun', '서지우': 'Seo Jiwoo', '문태오': 'Moon Taeo', '강라온': 'Kang Raon', '윤세찬': 'Yoon Sechan', '백이든': 'Baek Eden', '차민혁': 'Cha Minhyuk', '남궁설': 'Namgung Seol', '도하준': 'Do Hajun', '올레 린드': 'Ole Lind', '아리사와 켄': 'Ken Arisawa', '카이 로웬': 'Kai Rowen',
    '고르게 치는 상대': 'A balanced opponent', '실수가 적고 높고 깊게 넘김 · 결정타가 약함': 'Few errors, sends it high and deep · weak finishing shots', '드롭·헤어핀으로 앞을 노림 · 깊은 공에 약함': 'Attacks the front with drops and hairpins · weak against deep shots', '기회만 오면 스매시 · 실수가 잦고 네트 앞이 약함': 'Smashes at every chance · error-prone and weak at the net',
    '따봉': 'Thumbs up', '역따봉': 'Thumbs down', '웃음': 'Laugh', '울음': 'Cry', '자신만만': 'Confident', '짜증': 'Annoyed', '우웩': 'Yuck', '눈을 뜨세요': 'Open your eyes', '화이팅~': 'Let\'s go~', '안돼!': 'No!', '하하하': 'Hahaha', '나이스~': 'Nice~', '취소': 'Cancel',
    '균형형': 'Balanced', '기본 채. 장단점 없이 고르게.': 'The default racket. Even all round.', '헤드 헤비': 'Head-heavy', '스매시에 힘이 실리지만 스윙이 무거움.': 'More power on smashes, but a heavier swing.', '헤드 라이트': 'Head-light', '빠르게 다뤄 수비·타이밍이 편하지만 스매시가 약함.': 'Quick to handle for defense and timing, but weaker smashes.',
    '효과 없음 (친선게임·일일 챌린지와 같은 조건)': 'No effect (same as online matches and the daily challenge)',
    '유니폼': 'Kit', '채 색': 'Racket', '코트': 'Court', '네이비 스톰': 'Navy Storm', '민트 러시': 'Mint Rush', '체리 블라썸': 'Cherry Blossom', '화이트 아이스': 'White Ice', '블랙 골드': 'Black Gold', '기본 (유니폼 포인트 색)': 'Default (kit accent)', '네온 라임': 'Neon Lime', '핫 핑크': 'Hot Pink', '아이스 블루': 'Ice Blue', '골드': 'Gold',
    '그린 (기본)': 'Green (default)', '블루 코트': 'Blue Court', '퍼플 나이트': 'Purple Night', '클레이 오렌지': 'Clay Orange', '그레이 프로': 'Gray Pro',
    '리치': 'Reach', '팔 길이': 'arm length', '스피드': 'Speed', '다리·순발력': 'legs', '도약': 'leap', '지구력': 'endurance',
    '가장 긴 랠리': 'Longest rally', '내 최고 스매시': 'My top smash', '빨강팀': 'Red team', '파랑팀': 'Blue team', '스매시!': 'SMASH!', '배드민턴': 'BADMINTON',
    '오른쪽': 'right', '왼쪽': 'left', '켬': 'on', '끔': 'off', '무한': 'infinite', '그림자': 'shadow', '낙하 표시': 'landing marker', '(둘 다 적용)': '(applies to both)', '오른손잡이': 'Right-handed',
    '방향키 이동 ·': 'Arrows move ·', '런지 · 조준 ←→': 'lunge · aim ←→', '올리기 ·': 'lift ·', '찍기 ·': 'smash ·', '직선 ·': 'flat ·', '점프 ·': 'jump ·',
    '플레이': 'Play', '상점': 'Shop', '상점 열기': 'Open shop', '장착한 채': 'Racket',
    '코인은 경기·일일 챌린지·훈련으로만 얻어요 · 채 효과는 AI 대전·커리어에만 적용, 스킨은 겉모습만': 'Coins come only from matches, the daily challenge and training · racket effects apply in vs AI and Career only, skins are looks only',
    '끝까지 한 경기만 받을 수 있어요 · 쓰는 곳: 대기화면 상점 탭의 「내 채」와 「꾸미기」': 'Only finished matches pay out · spend them on "My racket" and "Customize" in the Shop tab',
    '한국어': '한국어'
  },
  U: { '점': ' pts', '타': ' hits', '경기': ' games', '명': ' players', '초': 's', '전': ' played', '승': 'W', '패': 'L', '코인': ' coins', '번': '×', '개': '' },
  RX: null,
  rules() {
    const T = s => this.core(s), N = '([\\d,.]+)';
    const R = (re, fn) => [new RegExp('^' + re + '$'), fn];
    return [
      R(N + '위', m => '#' + m[1]),
      R('([+\\-−±×]?[\\d,.]+)(점|타|경기|명|초|전|승|패|코인|번|개)', m => m[1] + this.U[m[2]]),
      R('(\\d+)승 (\\d+)패', m => `${m[1]}W ${m[2]}L`), R('(\\d+)전 (\\d+)승', m => `${m[1]} played, ${m[2]} won`),
      R('(승리!|패배\\.\\.\\.) (\\d+) : (\\d+)', m => `${m[1] === '승리!' ? 'Win!' : 'Lost...'} ${m[2]} : ${m[3]}`),
      R('(P[12]) 승리! P1 (\\d+) : (\\d+) P2', m => `${m[1]} wins! P1 ${m[2]} : ${m[3]} P2`),
      R('세트 스코어 (\\d+) : (\\d+)', m => `Sets ${m[1]} : ${m[2]}`), R('세트 스코어', () => 'Sets'), R('\\(vs (.+)\\)', m => `(vs ${T(m[1]) || m[1]})`), R('vs (.+)', m => `vs ${T(m[1]) || m[1]}`),
      R('(.+) 서브 \\((오른쪽|왼쪽) 코트\\)', m => `${m[1] === '내' ? 'Your' : m[1]} serve (${m[2] === '오른쪽' ? 'right' : 'left'} court)`),
      R('Q 꾹, 원하는 세기에서 떼기', () => 'hold Q, release at the power you want'), R('I 꾹, 원하는 세기에서 떼기', () => 'hold I, release at the power you want'),
      R('Q를 꾹: 게이지가 왕복, 원하는 세기에서 떼기', () => 'hold Q: the gauge swings, release at the power you want'), R('올리기를 꾹: 게이지가 왕복, 원하는 세기에서 떼기', () => 'hold Lift: the gauge swings, release at the power you want'),
      R('마우스로 방향', () => 'aim with the mouse'), R('←→로 방향', () => 'aim with ←→'), R('◀ ● ▶로 방향', () => 'aim with ◀ ● ▶'),
      R('랠리 (\\d+)!(?: 속도 x([\\d.]+))?', m => `Rally ${m[1]}!` + (m[2] ? ` Speed x${m[2]}` : '')), R('랠리 (\\d+)타', m => `${m[1]}-hit rally`),
      R('(나|상대|P1|P2)?\\s?(포핸드|백핸드|라운드 더 헤드)? ?(숏 서브|롱 서브|헤어핀|리프트|클리어|드롭|점프 스매시|스매시|푸시|드라이브)(!?)(?: (\\d+)km/h)?', m => [m[2] && this.EX[m[2]], this.EX[m[3]] + (m[4] || ''), m[5] && m[5] + 'km/h'].filter(Boolean).join(' ')),
      R('(.*\\S)! (\\d+)km/h', m => { const a = T(m[1]); return a && `${a}! ${m[2]}km/h`; }),
      R('(포핸드|백핸드|라운드 더 헤드) (머리 위|옆|아래)', m => `${this.EX[m[1]]} · ${this.EX[m[2]]}`),
      R('(득점|실점) · (.+)', m => { const b = T(m[2]); return b && `${m[1] === '득점' ? 'Point' : 'Point lost'} · ${b}`; }), R('(P[12]) 득점!?', m => `${m[1]} scores!`), R('(P[12]) 매치 포인트!', m => `${m[1]} match point!`),
      R('듀스! (\\d+) : (\\d+)', m => `Deuce! ${m[1]} : ${m[2]}`), R('코트 체인지! (\\d+) : (\\d+)', m => `Change of ends! ${m[1]} : ${m[2]}`),
      R('방 코드 복사됨: (.+)', m => `Room code copied: ${m[1]}`), R('(.+) 입장!', m => `${m[1]} joined!`), R('(.+)의 방에 들어왔어요', m => `Joined ${m[1]}'s room`),
      R('상대가 (.+)', m => { const b = T(m[1]); return b && `Opponent set ${b}`; }), R('(낙하 표시|그림자|체력) (켬|끔|무한)', m => `${this.EX[m[1]].toLowerCase()} ${this.EX[m[2]]}`),
      R('점수 (\\d+) : (\\d+)에서 멈춤', m => `paused at ${m[1]} : ${m[2]}`), R('같은 방 코드\\(', () => 'Rejoin with the same room code ('), R('\\)로 다시 들어오면 이어서 경기합니다', () => ') to continue the match'), R('\\)로 다시 들어오면 세트 스코어가 이어집니다', () => ') to keep the set score'),
      R('방', () => 'Room'), R('에 들어가는 중…', () => '— joining…'), R('에서 방장을 기다리는 중…', () => '— waiting for the host…'),
      R('상대를 찾는 중…', () => 'Finding an opponent…'), R('내 매칭 점수', () => 'My rating'), R('매칭 점수 (\\d+)', m => `rating ${m[1]}`), R('매칭 점수 (\\d+) →', m => `Rating ${m[1]} →`), R('찾는 범위 ±(\\d+)점', m => `range ±${m[1]}`), R('대기 중인 사람 (\\d+)명', m => `${m[1]} waiting`),
      R('(\\d+)초 동안 아무도 없으면 AI와 대전합니다', m => `If nobody shows up in ${m[1]}s you play the AI`), R('Esc = 취소', () => 'Esc = cancel'), R('선수 Lv\\.(\\d+)', m => `player Lv.${m[1]}`), R('\\(([+\\-]?\\d+)\\)', m => `(${m[1]})`), R('상대 (\\d+)', m => `opponent ${m[1]}`),
      R('대기 중인 사람이 없어 AI\\((.+)\\)와 대전합니다', m => `Nobody is waiting — playing the AI (${T(m[1])})`),
      R('빠른 대전 (\\d+)전 (\\d+)승', m => `quick matches ${m[1]}, won ${m[2]}`),
      R('이기면 오르고 지면 내려가요\\. 처음엔 ±(\\d+)점 안에서 찾고, 기다릴수록 범위가 넓어져요\\. (\\d+)초 동안 아무도 없으면 AI와 대전', m => `goes up when you win, down when you lose. The search starts within ±${m[1]} and widens as you wait. After ${m[2]}s with nobody, you play the AI`),
      R('(.+) — 이 모드는 아직 준비 중이에요\\.', m => `${T(m[1]) || m[1]} — this mode is not ready yet.`),
      R('오늘의 종목', () => "Today's drill"), R('성공 1번 = (\\d+)점 \\+ 연속 보너스\\(2번째부터 \\+(\\d+)씩, 최대 \\+(\\d+)\\)', m => `1 success = ${m[1]} pts + streak bonus (+${m[2]} each from the 2nd, up to +${m[3]})`), R('만점 ' + N + '점', m => `max ${m[1]} pts`),
      R('오늘 최고', () => 'Best today'), R('오늘 내 최고 ' + N + '점', m => `Your best today: ${m[1]} pts`), R('도전 (\\d+)번', m => `${m[1]} tries`), R('(\\d+)번 도전', m => `${m[1]} tries`),
      R('(쉬움|중간|어려움|지옥|임파서블)\\+? (기본|수비형|네트형|스매시형)', m => `${this.EX[m[1]]}${/\+/.test(m[0]) ? '+' : ''} ${this.EX[m[2]]}`), R('(쉬움|중간|어려움|지옥|임파서블) (\\d+)', m => `${this.EX[m[1]]} ${m[2]}`),
      R('(동네|시|전국|세계) 대회 (8강|준결승|결승)', m => `${this.EX[m[1] + ' 대회']} ${this.EX[m[2]]}`), R('(동네|시|전국|세계) 대회 우승!', m => `${this.EX[m[1] + ' 대회']} champion!`), R('🏆 ?(.*)', m => { const b = T(m[1]); return b != null && `🏆 ${b}`; }),
      R('통과', () => 'cleared'), R('([^—]+)에게 졌어요', m => `lost to ${T(m[1]) || m[1]}`), R('다음 상대:', () => 'Next opponent:'),
      R('(.+) \\((기본|수비형|네트형|스매시형): (.+)\\)', m => `${T(m[1]) || m[1]} (${this.EX[m[2]]}: ${T(m[3])})`), R('(.+) \\((기본|수비형|네트형|스매시형)\\)', m => `${T(m[1]) || m[1]} (${this.EX[m[2]]})`),
      R('구매 🪙 ?' + N + '?', m => 'Buy 🪙 ' + (m[1] || '')), R('코인 부족 \\(' + N + ' 더 필요\\)', m => `Not enough coins (${m[1]} more)`), R('\\(' + N + ' 더 필요\\)', m => `(${m[1]} more)`),
      R('강화 \\+(\\d) 🪙 ' + N, m => `Upgrade +${m[1]} 🪙 ${m[2]}`), R('강화 \\+(\\d) — 코인 부족 \\(' + N + ' 더 필요\\)', m => `Upgrade +${m[1]} — not enough coins (${m[2]} more)`),
      R('(.+) 채를 (\\d+)코인에 살까요\\?', m => `Buy the ${T(m[1])} racket for ${m[2]} coins?`), R('(.+) 「(.+)」을\\(를\\) (\\d+)코인에 살까요\\?', m => `Buy ${T(m[1])} "${T(m[2])}" for ${m[3]} coins?`),
      R('(.+) \\+(\\d) 강화 \\((\\d+)코인\\)', m => `${T(m[1])} +${m[2]} upgrade (${m[3]} coins)`), R('장점: (.+)', m => { const b = T(m[1]); return b && `Upside: ${b}`; }), R('단점: (.+)', m => { const b = T(m[1]); return b && `Downside: ${b}`; }), R('강화 단계는 나중에 낮춰 쓸 수 있어요\\.', () => 'You can use a lower upgrade level later.'),
      R('＋ (.+)', m => { const b = T(m[1]); return b && `＋ ${b}`; }), R('－ (.+)', m => { const b = T(m[1]); return b && `－ ${b}`; }),
      R('(균형형|헤드 헤비|헤드 라이트)(?: \\+(\\d))?', m => this.EX[m[1]] + (m[2] ? ' +' + m[2] : '')),
      R('스매시 각 ([+\\-−][\\d.]+)° \\(더 가파르고 빠르게\\)', m => `smash angle ${m[1]}° (steeper, faster)`), R('스매시 각 ([+\\-−][\\d.]+)° \\(더 날카롭고 빠르게\\)', m => `smash angle ${m[1]}° (sharper, faster)`), R('스매시 각 ([+\\-−][\\d.]+)° \\(더 완만하고 느리게\\)', m => `smash angle ${m[1]}° (flatter, slower)`),
      R('상대 반응 \\+(\\d+)ms', m => `opponent reacts +${m[1]}ms later`), R('상대 리턴 오차 \\+(\\d+)%', m => `opponent return error +${m[1]}%`), R('충전 시간 ([+\\-−]\\d+%)', m => `charge time ${m[1]}`), R('정타 여유 ([+\\-−]\\d+%)', m => `timing window ${m[1]}`),
      R('내 슬로우 범위 \\+([\\d.]+)m \\(기본 ([\\d.]+)m → ([\\d.]+)m\\)', m => `my slow-motion radius +${m[1]}m (${m[2]}m → ${m[3]}m)`), R('경기 중 (\\d+)% 확률로 낙하 지점 힌트\\(하늘색\\)가 일찍 보임', m => `${m[1]}% chance of an early landing hint (light blue) in matches`),
      R('다음 레벨: 연속 (\\d+)번 성공', m => `Next level: ${m[1]} in a row`), R('현재 효과: (.+)', m => { const b = T(m[1]); return b && `Current effect: ${b}`; }), R('다음 레벨까지 ' + N + ' 경험치', m => `${m[1]} XP to next level`),
      R('타격 판정 거리 \\+([\\d.]+)cm', m => `hit reach +${m[1]}cm`), R('이동 속도 \\+(\\d+)%', m => `move speed +${m[1]}%`), R('점프 초기속도 \\+(\\d+)% \\(높이 약 \\+(\\d+)%\\)', m => `jump speed +${m[1]}% (height about +${m[2]}%)`), R('최대 체력 \\+(\\d+) \\(기본 100\\)', m => `max stamina +${m[1]} (base 100)`),
      R('경험치: 승리 (\\d+)', m => `XP: win ${m[1]}`), R('패배 최대 (\\d+)\\(점수 비례\\)', m => `loss up to ${m[1]} (by score)`), R('훈련 레벨업 (\\d+)', m => `training level-up ${m[1]}`), R('일일 챌린지 첫 도전 (\\d+)', m => `first daily challenge ${m[1]}`), R('친선게임 (\\d+)', m => `online match ${m[1]}`),
      R('스탯마다 최대 (\\d+), 포인트는 모두 (\\d+)개라 전부 채울 수는 없어요', m => `max ${m[1]} per stat, and only ${m[2]} points in total, so you cannot max everything`),
      R('(리치|스피드|점프|체력) (올리기|내리기)', m => `${this.EX[m[1]]} ${m[2] === '올리기' ? 'up' : 'down'}`), R('(.+) — (\\d+)코인 \\((\\d+) 더 필요\\)', m => `${T(m[1])} — ${m[2]} coins (${m[3]} more needed)`), R('(.+) — (\\d+)코인', m => `${T(m[1])} — ${m[2]} coins`), R('🪙 ' + N, m => `🪙 ${m[1]}`),
      R('\\+' + N + ' 코인', m => `+${m[1]} coins`), R('보유 ' + N, m => `balance ${m[1]}`), R('🪙 친선게임 코인은 하루 (\\d+)경기까지 \\(오늘은 다 받았어요\\)', m => `🪙 Online-match coins are limited to ${m[1]} games a day (all claimed today)`),
      R('(승리|참가) · 오늘 (\\d)/(\\d)', m => `${m[1] === '승리' ? 'win' : 'played'} · today ${m[2]}/${m[3]}`), R('오늘 (\\d+)/(\\d+)', m => `today ${m[1]}/${m[2]}`), R('\\((.+)\\)', m => { const b = T(m[1]); return b && `(${b})`; }),
      R('선수 경험치 \\+(\\d+)', m => `Player XP +${m[1]}`), R('Lv\\.(\\d+)(?: \\((\\d+)/(\\d+)\\))?', m => m[0]), R('Lv\\.(\\d+) \\(최고 레벨\\)', m => `Lv.${m[1]} (max level)`), R('레벨 업! 스탯 포인트 \\+(\\d+)', m => `Level up! +${m[1]} stat point`), R('\\(대기화면 「내 선수」\\)', () => '("My player" on the menu)'), R('—', () => '—'),
      R('· 업로드 대기 (\\d+)경기', m => `· ${m[1]} games waiting to upload`), R('15점 ×([\\d.]+)', m => `to 15 ×${m[1]}`), R('21점 ×([\\d.]+)', m => `to 21 ×${m[1]}`), R('승리 보상의 (\\d+)% × \\(내 점수 ÷ 목표 점수\\)', m => `${m[1]}% of the win reward × (your points ÷ target)`),
      R('(\\d+)타 \\+(\\d+)', m => `${m[1]} hits +${m[2]}`), R('(\\d+)타 \\+(\\d+) \\(경기당 한 번\\)', m => `${m[1]} hits +${m[2]} (once per match)`), R('처음 깨는 경기 ×(\\d+)', m => `first clear ×${m[1]}`), R('대회 첫 우승 \\+(.+)', m => `first tournament win +${m[1]}`),
      R('첫 도전 \\+(\\d+)', m => `first try +${m[1]}`), R('최고 점수 (\\d+)점당 1(?: \\(오늘 (\\d+) 받음\\))?', m => `1 per ${m[1]} pts of your best` + (m[2] ? ` (${m[2]} claimed today)` : '')), R('승 (\\d+)', m => `win ${m[1]}`), R('패 (\\d+) \\(오늘 (\\d)/(\\d)경기\\)', m => `loss ${m[1]} (today ${m[2]}/${m[3]})`),
      R('AI 대전 (승|패)', m => `vs AI ${m[1] === '승' ? 'win' : 'loss'}`), R('친선게임 (승|패)', m => `Online ${m[1] === '승' ? 'win' : 'loss'}`), R('(커리어|훈련 레벨업|채 구매|채 강화|스킨) · (.+)', m => `${{ '커리어': 'Career', '훈련 레벨업': 'Level-up', '채 구매': 'Racket', '채 강화': 'Upgrade', '스킨': 'Skin' }[m[1]]} · ${T(m[2]) || m[2]}`),
      R('(유니폼|채 색|코트) (.+)', m => { const b = T(m[2]); return b && `${this.EX[m[1]]}: ${b}`; }),
      R('(일일 챌린지|튜토리얼|친선게임|빠른 대전|커리어|AI 대전) ·', m => this.EX[m[1]] + ' ·'), R('(근력|순발력|판단력) 훈련', m => `${this.EX[m[1]]} training`), R('(근력|순발력|판단력) Lv\\.(\\d) 달성!(.*)', m => `${this.EX[m[1]]} Lv.${m[2]} reached!${m[3]}`),
      R('일일 챌린지 끝', () => 'Daily challenge finished'), R('\\(성공 (\\d+)/(\\d+)', m => `(${m[1]}/${m[2]} hit`), R('최고 연속 (\\d+)\\)', m => `best streak ${m[1]})`), R('오늘 순위', () => "Today's rank"), R('\\(연속 (\\d+)\\)', m => `(streak ${m[1]})`), R('· 연속 끊김', () => '· streak broken'),
      R('(.+) \\+(\\d+)', m => { const a = T(m[1]); return a && `${a} +${m[2]}`; }), R('(.+) \\((\\d+)/(\\d+)\\)', m => { const a = T(m[1]); return a && `${a} (${m[2]}/${m[3]})`; }),
      R('(\\d+)/(\\d+)월? ?.*', m => null),
      R('배드민턴 랠리 (승리|패배) (\\d+):(\\d+)', m => `Badminton Rally ${m[1] === '승리' ? 'win' : 'loss'} ${m[2]}:${m[3]}`), R('AI (쉬움|중간|어려움|지옥|임파서블)', m => `AI ${this.EX[m[1]]}`),
      R('(대기열|방 채널) 연결 실패 \\((.+)\\)', m => `Connection failed (${m[2]})`), R('(\\d+)점', m => `${m[1]} pts`)
    ];
  },

  // 한 조각(구분 기호 없는 단위) 번역 → 못 하면 null
  one(s) {
    if (!this.HAN.test(s)) return s;
    if (Object.prototype.hasOwnProperty.call(this.EX, s)) return this.EX[s];
    for (const [re, fn] of this.RX) { const m = re.exec(s); if (m) { const r = fn(m); if (r != null && r !== false && !this.HAN.test(r)) return r; } }
    return null;
  },
  // 문장 번역(앞뒤 공백 없는 글) → 못 하면 null
  core(s, depth) {
    depth = depth || 0;
    if (!this.HAN.test(s)) return s;
    let r = this.one(s); if (r != null) return r;
    if (depth > 4) return null;
    for (const sep of ['\n', ' — ', ' · ', ' / ']) {
      if (!s.includes(sep)) continue;
      const out = s.split(sep).map(p => { const lead = /^\s*/.exec(p)[0], tail = /\s*$/.exec(p)[0], c = p.trim(); if (!c) return p; const x = this.core(c, depth + 1); return x == null ? null : lead + x + tail; });
      if (out.every(x => x != null)) return out.join(sep);
    }
    let m = /^([·—]) (.+)$/.exec(s); if (m) { r = this.core(m[2], depth + 1); if (r != null) return m[1] + ' ' + r; }
    m = /^(.+) ([·—])$/.exec(s); if (m) { r = this.core(m[1], depth + 1); if (r != null) return r + ' ' + m[2]; }
    if (/^\([^)]*$/.test(s)) { r = this.core(s.slice(1), depth + 1); if (r != null) return '(' + r; }   // 괄호가 조각 경계에서 갈린 경우
    if (/^[^(]*\)$/.test(s)) { r = this.core(s.slice(0, -1), depth + 1); if (r != null) return r + ')'; }
    m = /^(.*\S) \(([^()]+)\)$/.exec(s); if (m) { const a = this.core(m[1], depth + 1), b = this.core(m[2], depth + 1); if (a != null && b != null) return `${a} (${b})`; }
    m = /^(.*[가-힣)!])\s([^가-힣]+)$/.exec(s); if (m) { const a = this.core(m[1], depth + 1); if (a != null) return a + ' ' + m[2]; }
    m = /^([^가-힣]+)\s([가-힣].*)$/.exec(s); if (m) { const b = this.core(m[2], depth + 1); if (b != null) return m[1] + ' ' + b; }
    return null;
  },
  t(s) {
    if (this.lang !== 'en' || typeof s !== 'string' || !this.HAN.test(s)) return s;
    if (this.cache.has(s)) return this.cache.get(s);
    const c = s.trim(), r = this.core(c);
    const out = r == null ? s : s.replace(c, () => r);
    if (r == null) this.miss.add(c);
    if (this.cache.size > 4000) this.cache.clear();
    this.cache.set(s, out); return out;
  },
  missing() { return [...this.miss]; },

  // ── 화면 적용 ──
  node(n) {
    if (n.nodeType === 3) { const p = n.parentNode; if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || p.nodeName === 'TEXTAREA')) return; const v = n.nodeValue, r = this.t(v); if (r !== v) n.nodeValue = r; return; }
    if (n.nodeType !== 1 || n.id === 'classic' || n.id === 'langBtn') return;
    for (const a of ['placeholder', 'title', 'aria-label']) { const v = n.getAttribute && n.getAttribute(a); if (v && this.HAN.test(v)) { const r = this.t(v); if (r !== v) n.setAttribute(a, r); } }
    for (let c = n.firstChild; c; c = c.nextSibling) this.node(c);
  },
  start() {
    try { this.lang = localStorage.getItem(this.KEY) === 'en' ? 'en' : 'ko'; } catch (e) { /* 무시 */ }
    this.RX = this.rules();
    const h1 = document.querySelector('#lobby h1');
    if (h1) {
      const b = document.createElement('button'); b.id = 'langBtn'; b.className = 'langbtn'; b.textContent = this.lang === 'en' ? '한국어' : 'English'; b.title = this.lang === 'en' ? '한국어로 보기' : 'Switch to English';
      b.addEventListener('click', () => { try { localStorage.setItem(this.KEY, this.lang === 'en' ? 'ko' : 'en'); } catch (e) { /* 무시 */ } location.reload(); });
      h1.appendChild(b);
    }
    if (this.lang !== 'en') return;
    document.documentElement.lang = 'en'; document.title = 'Badminton Rally — 3D badminton in your browser';
    const oc = window.confirm; window.confirm = m => oc.call(window, this.t(String(m)));
    this.node(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') this.node(m.target);
        else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v && this.HAN.test(v)) { const r = this.t(v); if (r !== v) m.target.setAttribute(m.attributeName, r); } }
        else for (const n of m.addedNodes) this.node(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  }
};

const TUTORIAL_3D_PAGES_EN = [
  { t: '1. Basic controls (3D Court)', b: '<b>WASD</b> move · <b>mouse</b> = shot direction (the dotted line at your feet points to the cursor)<br><b>Q</b> lift · <b>E</b> smash · <b>left click</b> flat — all are <b>hold to charge, swing on release</b><br><b>Space</b> jump · <b>Shift</b> lunge · <b>Esc</b> menu' },
  { t: '2. Charge = shot type', b: 'The <b>mouse</b> sets the direction; the <b>charge</b> sets distance and shot type.<br><b>Q lift</b>: short → hairpin/lift, long → clear<br><b>E smash</b>: short → drop, long → smash (jump smash in the air)<br><b>Left click flat</b>: short → push, long → drive<br>Holding into the <b>red zone</b> at the right of the gauge fails: lift and flat go <b>out</b>, smash goes into the <b>net</b>.' },
  { t: '3. Slow-motion timing', b: 'When the shuttle comes <b>right next to your racket arm</b> (about 1.4 m) the whole game briefly slows down (the screen edges darken).<br>The slow-down is short, so <b>hold to charge early</b> and <b>release as the shuttle reaches your racket</b>.<br>Release too early and you whiff!<br>The longer the rally, the <b>faster the shuttle and the game</b> (up to 1.4×) and the <b>smaller the slow-motion radius</b>.<br><b>Right at the net</b> the radius shrinks by up to 30%.<br>Charging Q or E <b>past 80%</b> shortens the hit window; at 100% you must release at <b>exactly the right moment</b>.' },
  { t: '4. Forehand · backhand (automatic)', b: 'On your racket side it is a <b>forehand</b>, on the other side a <b>backhand</b> — shown at the bottom of the screen in advance.<br>Backhands travel less far and are less accurate. A close overhead shuttle on the backhand side is taken <b>round the head</b> (as a forehand).<br>You can switch to <b>left-handed</b> on the menu.' },
  { t: '5. Serving and rules (real singles rules)', b: 'Serve from the <b>right court on even scores, the left on odd</b>, into the <b>diagonal</b> service court (past the short service line, up to the baseline).<br>Your serve: <b>hold Q</b> — the gauge swings <b>back and forth</b>. Release low for a short serve, high for a long serve. Releasing in the red zones at either end (net/out) is a fault.<br>On the line is in. 21 points, win by 2 from 20–20, first to 30 at 29–29.' },
  { t: '6. You cannot smash a low shuttle', b: 'The smash (E) only works from a <b>high contact point</b> — hit down from below net height and it goes straight into the net.<br>Take low shuttles with Q (lift) or left click (push). Use <b>Space to jump</b> for a higher contact point.' },
  { t: '7. Shift lunge', b: '<b>Shift</b> takes one big step (about 1.1 m) with your arm stretched out, adding 0.45 m of reach.<br>Direction: <b>your movement keys if held</b>, otherwise <b>automatically toward where the shuttle is going</b>.<br>A <b>lunge at the net + Q (hairpin/lift) or left click (push)</b> is actually more accurate — that is how real players take net shots.<br>Lunging for a deep shuttle sends it a bit shorter. Ready again about 1 second after use (shown bottom left). Lunges, jumps, running and charged swings use <b>stamina</b>.' },
  { t: '8. Training — build your player', b: 'Pick <b>3D Court → Training</b> on the menu. Fill the streak to level up (max Lv.5); level effects apply in <b>vs AI and Career</b>.<br><b>Power</b>: smash high shuttles into the yellow target → steeper, faster smashes and slower opponent reactions<br><b>Agility</b>: return the opponent\'s smashes → a much larger slow-motion radius<br><b>Judgment</b>: call in/out near the lines → occasional early landing hints (light blue) in matches' },
  { t: '9. Online: Friendly and Quick match', b: '<b>Friendly</b>: one player presses <b>Create room</b> and shares the <b>5-letter code</b>; the friend enters it and presses <b>Join</b>.<br><b>Quick match</b>: finds a player with a similar rating automatically (first to 11). If nobody is waiting you play the AI.<br>Both players see themselves at the front of the screen. The host serves first and sets the target score.<br>You need internet; with high latency the opponent may look slightly delayed. Keep the window visible during a match — a hidden tab pauses your side.' },
  { t: '10. Landing marker', b: 'Press <b>L</b> or the <b>📍 Landing</b> button to toggle the shuttle landing marker (remembered in your browser).<br>When off, no landing marker or light-blue hints appear at any difficulty. <b>In online matches a change by either player applies to both</b> (same for the shuttle shadow, G, and stamina).' },
  { t: '11. Emotes · shadow · change of ends', b: '<b>Hold T</b> to open the wheel. <b>Move the mouse</b> to choose (inner = faces, outer = phrases) and <b>release T</b> to send. Release in the middle to cancel.<br><b>G</b> or the 🌑 button hides the shuttle shadow and drop line (then you judge in/out by eye).<br>In games to 15 or more, the players <b>change ends</b> when one reaches half (8 of 15, 11 of 21).<br>If your opponent leaves a Friendly match it pauses; <b>rejoining with the same code from the same browser continues from that score</b>.' },
  { t: '12. Career · daily challenge · coins', b: '<b>Career</b>: win the Local → City → National → World Open in turn. Each has 3 matches (quarterfinal, semifinal, final) against opponents with different styles and strength. Lose and you retry just that match.<br><b>Daily challenge</b>: one drill per day (resets at midnight Korea time) with the <b>same 15 shuttles</b> for everyone. 100 pts per success plus a streak bonus (up to +100). Best score counts; log in to appear on the leaderboard.<br><b>Coins</b> come from finished matches, the daily challenge, long rallies and training level-ups. Spend them on rackets (vs AI / Career only) and looks.<br>There is no music; the crowd applauds only for <b>smash winners, rallies over 10 hits and dramatic saves</b>. <b>M</b> = mute.' }
];
I18N.start();

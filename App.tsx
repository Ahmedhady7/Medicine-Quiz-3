
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { TRANSLATIONS } from './constants';
import { Difficulty, QuestionType, User, Subject, Quiz, QuizAttempt } from './types';
import { generateMedicalQuestions } from './services/geminiService';

/** --- Utility for Sharing --- */
const encodeQuiz = (quiz: Quiz) => btoa(encodeURIComponent(JSON.stringify(quiz)));
const decodeQuiz = (data: string): Quiz | null => {
  try { return JSON.parse(decodeURIComponent(atob(data))); } 
  catch { return null; }
};

/** --- Components --- */

const Navbar = ({ lang, setLang, user, onLogin, onLogout }: any) => {
  const strings = TRANSLATIONS[lang];
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <nav className={`bg-white/80 backdrop-blur-md border-b sticky top-0 z-50 px-4 md:px-8 py-3 flex justify-between items-center ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="flex items-center gap-4">
        {!isHome && (
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-indigo-600">
            {lang === 'ar' ? '←' : '←'}
          </button>
        )}
        <h1 onClick={() => navigate('/')} className="text-xl md:text-2xl font-black text-indigo-600 cursor-pointer flex items-center gap-2">
          <span className="text-3xl">⚕️</span> <span className="hidden sm:inline">{strings.title}</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="text-xs font-bold text-slate-500 hover:text-indigo-600">
          {lang === 'en' ? 'العربية' : 'English'}
        </button>

        {user.isLoggedIn ? (
          <div className="flex items-center gap-3 border-l pl-4 border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{strings.welcome}</p>
              <p className="text-sm font-bold text-slate-700 leading-none">{user.name}</p>
            </div>
            <img src={user.photo} className="w-10 h-10 rounded-full border-2 border-indigo-100 shadow-sm" alt="profile" />
            <button onClick={onLogout} className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase">{strings.logout}</button>
          </div>
        ) : (
          <button onClick={onLogin} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95 text-sm font-bold">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="google" />
            <span className="hidden xs:inline">{strings.login}</span>
          </button>
        )}
      </div>
    </nav>
  );
};

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow ${className}`}>
    {children}
  </div>
);

/** --- Views --- */

const Dashboard = ({ strings, subjects, setSubjects, attempts, quizzes, lang }: any) => {
  const navigate = useNavigate();
  const [newSub, setNewSub] = useState('');

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubjects([...subjects, { id: Date.now().toString(), name: newSub, chapters: [] }]);
    setNewSub('');
  };

  const handleShare = (quiz: Quiz) => {
    const code = encodeQuiz(quiz);
    const url = `${window.location.origin}${window.location.pathname}#/import?data=${code}`;
    navigator.clipboard.writeText(url);
    alert(strings.copySuccess);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-4 space-y-6">
        <Card>
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">📑 {strings.subjects}</h2>
          <div className="flex gap-2 mb-6">
            <input value={newSub} onChange={e => setNewSub(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="..." />
            <button onClick={addSub} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl font-black text-xl">+</button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {subjects.map((s: any) => (
              <div key={s.id} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-sm font-bold text-slate-600 hover:bg-indigo-50 transition-colors">
                <span>{s.name}</span>
                <span className="text-[10px] bg-white px-2 py-1 rounded-full border">{s.chapters.length} Ch</span>
              </div>
            ))}
          </div>
        </Card>
        
        <button onClick={() => navigate('/create')} className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] shadow-xl hover:bg-indigo-700 transition-all font-black text-xl flex items-center justify-center gap-3">
          ✨ {strings.generateQuiz}
        </button>
      </div>

      <div className="lg:col-span-8 space-y-8">
        <Card>
           <h2 className="text-xl font-black mb-6">📚 اختباراتي المحفوظة</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {quizzes.length > 0 ? quizzes.map((q: Quiz) => (
               <div key={q.id} className="p-5 border border-slate-100 rounded-3xl bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[10px] font-black uppercase px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg">{q.difficulty}</span>
                     <button onClick={() => handleShare(q)} className="text-xs font-bold text-indigo-600 hover:underline">🔗 {strings.share}</button>
                   </div>
                   <h3 className="font-black text-slate-800 line-clamp-2">{q.title}</h3>
                 </div>
                 <button onClick={() => navigate(`/quiz/${q.id}`)} className="mt-4 w-full py-3 bg-white border border-indigo-600 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all">
                    {strings.startQuiz}
                 </button>
               </div>
             )) : (
               <div className="col-span-2 text-center py-10 text-slate-400 font-bold italic">لا يوجد اختبارات بعد.. قم بإنشاء واحد!</div>
             )}
           </div>
        </Card>

        <div className="grid grid-cols-2 gap-6">
          <button onClick={() => navigate('/stats')} className="p-10 bg-white border rounded-[2.5rem] flex flex-col items-center gap-4 hover:shadow-lg transition-all group">
            <span className="text-4xl group-hover:scale-125 transition-transform">📊</span>
            <span className="font-black text-slate-700">{strings.stats}</span>
          </button>
          <button onClick={() => navigate('/leaderboard')} className="p-10 bg-white border rounded-[2.5rem] flex flex-col items-center gap-4 hover:shadow-lg transition-all group">
            <span className="text-4xl group-hover:scale-125 transition-transform">🏆</span>
            <span className="font-black text-slate-700">{strings.leaderboard}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateQuiz = ({ strings, subjects, quizzes, setQuizzes }: any) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [subId, setSubId] = useState(subjects[0]?.id || '');
  const [diff, setDiff] = useState(Difficulty.MEDIUM);
  const [type, setType] = useState(QuestionType.MIX);
  const [count, setCount] = useState(15);
  const [targetLang, setTargetLang] = useState('original');

  const handleGenerate = async () => {
    if (!files.length) return alert("الرجاء رفع الملفات أولاً");
    setLoading(true);
    try {
      let content = "";
      for (const f of files) content += await f.text() + "\n";
      const questions = await generateMedicalQuestions(content, count, type, diff, targetLang as any);
      
      const newQuiz: Quiz = {
        id: Math.random().toString(36).substr(2, 9),
        title: files[0]?.name.split('.')[0] || "Medical Assessment",
        subjectId: subId,
        chapterId: '',
        difficulty: diff,
        questions,
        createdAt: Date.now()
      };
      
      setQuizzes([...quizzes, newQuiz]);
      navigate(`/quiz/${newQuiz.id}`);
    } catch (e) {
      alert("فشل في توليد الأسئلة. تأكد من جودة المحتوى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in zoom-in duration-500">
      <Card className="p-10 !rounded-[3rem]">
        <h2 className="text-3xl font-black text-center mb-10 text-slate-800">{strings.generateQuiz}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="border-4 border-dashed border-indigo-50 rounded-[2rem] p-12 text-center bg-indigo-50/20 hover:bg-indigo-50 transition-all relative group cursor-pointer">
              <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFiles(Array.from(e.target.files || []))} />
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📄</div>
              <p className="font-black text-indigo-600">{strings.uploadFiles}</p>
              <p className="text-xs text-slate-400 mt-2 font-bold">{files.length} ملفات جاهزة</p>
            </div>
            <select value={subId} onChange={e => setSubId(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none text-slate-600 appearance-none shadow-inner">
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{strings.difficulty}</label>
              <div className="grid grid-cols-2 gap-2">
                {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.VERY_HARD].map(d => (
                  <button key={d} onClick={() => setDiff(d)} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${diff === d ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>
                    {strings[d === Difficulty.VERY_HARD ? 'veryHard' : d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none">
                  <option value={QuestionType.MCQ}>{strings.mcq}</option>
                  <option value={QuestionType.TRUE_FALSE}>{strings.tf}</option>
                  <option value={QuestionType.MIX}>{strings.mix}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Count</label>
                <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-center text-xl outline-none" />
              </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{strings.translate}</label>
               <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                 {['original', 'ar', 'en'].map(l => (
                   <button key={l} onClick={() => setTargetLang(l)} className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase transition-all ${targetLang === l ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>
                     {strings[l as keyof typeof strings] || l}
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={loading} className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-2xl shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all hover:scale-[1.01]">
          {loading ? 'الذكاء الاصطناعي يقوم بتحليل المحتوى الطبي...' : strings.generateQuiz}
        </button>
      </Card>
    </div>
  );
};

const QuizInterface = ({ strings, setAttempts, quizzes, user }: any) => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [cur, setCur] = useState(0);
  const [ans, setAns] = useState<any>({});
  const [showExpl, setShowExpl] = useState(false);
  const [showRes, setShowRes] = useState(false);
  const [start] = useState(Date.now());

  const quiz = useMemo(() => quizzes.find((q: any) => q.id === quizId), [quizId, quizzes]);

  if (!quiz) return <div className="text-center py-20 font-black text-slate-300">الاختبار غير موجود..</div>;

  const current = quiz.questions[cur];
  const progress = ((cur + 1) / quiz.questions.length) * 100;

  const onAnswer = (opt: string) => {
    if (showExpl) return;
    setAns({...ans, [current.id]: opt});
    setShowExpl(true);
  };

  const onNext = () => {
    setShowExpl(false);
    if (cur < quiz.questions.length - 1) setCur(cur + 1);
    else {
      const score = quiz.questions.reduce((a: number, q: any) => a + (ans[q.id] === q.correctAnswer ? 1 : 0), 0);
      const attempt: QuizAttempt = {
        id: Date.now().toString(), quizId: quiz.id, userId: user.id, userName: user.name,
        score, totalQuestions: quiz.questions.length, timeSpent: Math.round((Date.now() - start)/60000), date: Date.now()
      };
      setAttempts((p: any) => [...p, attempt]);
      setShowRes(true);
    }
  };

  if (showRes) {
    const score = quiz.questions.reduce((a: number, q: any) => a + (ans[q.id] === q.correctAnswer ? 1 : 0), 0);
    return (
      <div className="max-w-3xl mx-auto animate-in zoom-in duration-500">
        <Card className="text-center p-16 !rounded-[4rem] border-t-8 border-indigo-600">
          <div className="text-8xl mb-6">🏆</div>
          <h2 className="text-4xl font-black mb-10 text-slate-800">{strings.results}</h2>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="p-6 bg-slate-50 rounded-3xl"><p className="text-5xl font-black text-indigo-600">{score}/{quiz.questions.length}</p><p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-2">{strings.score}</p></div>
            <div className="p-6 bg-slate-50 rounded-3xl"><p className="text-5xl font-black text-indigo-600">{Math.round((Date.now()-start)/1000)}s</p><p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-2">{strings.time}</p></div>
          </div>
          <button onClick={() => navigate('/')} className="px-12 py-5 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-all">العودة للرئيسية</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8 sticky top-20 z-40 bg-slate-50/80 backdrop-blur py-4 px-2">
        <div className="flex justify-between items-center font-black text-xs text-indigo-600 mb-3 uppercase tracking-widest">
          <span>Question {cur+1} / {quiz.questions.length}</span>
          <span className="px-2 py-1 bg-indigo-100 rounded-lg">{quiz.difficulty}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-3 bg-white rounded-full overflow-hidden shadow-inner border border-slate-200">
          <div className="h-full bg-indigo-600 transition-all duration-700" style={{width: `${progress}%`}} />
        </div>
      </div>

      <Card className="p-10 md:p-16 !rounded-[3.5rem] relative">
        <h3 className="text-2xl md:text-3xl font-black mb-14 text-slate-800 leading-snug">{current.text}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(current.options || ['True', 'False']).map((opt, i) => {
             const isSel = ans[current.id] === opt;
             const isCorr = opt === current.correctAnswer;
             let style = "border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-indigo-100";
             if (showExpl) {
               if (isCorr) style = "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100";
               else if (isSel) style = "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-100";
               else style = "opacity-40 grayscale pointer-events-none";
             } else if (isSel) {
               style = "bg-indigo-600 border-indigo-600 text-white scale-105 shadow-xl shadow-indigo-100";
             }

             return (
               <button key={i} onClick={() => onAnswer(opt)} className={`p-6 rounded-[2rem] border-2 font-black transition-all text-right flex items-center gap-4 ${style}`}>
                 <span className={`w-10 h-10 flex-shrink-0 rounded-2xl flex items-center justify-center font-black text-lg ${isSel || (showExpl && isCorr) ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                   {String.fromCharCode(65+i)}
                 </span>
                 <span className="text-lg">{opt}</span>
               </button>
             );
          })}
        </div>

        {showExpl && (
          <div className="mt-12 p-8 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 animate-in slide-in-from-top-4 duration-500">
             <h4 className="font-black text-indigo-800 mb-2 flex items-center gap-2">💡 التفسير الطبي:</h4>
             <p className="text-indigo-900/70 font-bold leading-relaxed">{current.explanation}</p>
          </div>
        )}

        <div className="mt-16 flex justify-between items-center">
          <button onClick={() => navigate('/')} className="text-slate-400 font-black hover:text-rose-500 transition-colors uppercase text-[10px] tracking-widest">End Session</button>
          <button onClick={onNext} disabled={!ans[current.id]} className="px-14 py-5 bg-slate-900 text-white rounded-[2.2rem] font-black shadow-2xl active:scale-95 disabled:opacity-20 transition-all flex items-center gap-3">
            {cur === quiz.questions.length - 1 ? strings.finish : strings.next}
            <span className="text-lg">➜</span>
          </button>
        </div>
      </Card>
    </div>
  );
};

const ImportQuiz = ({ quizzes, setQuizzes }: any) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const data = params.get('data');
    if (data) {
      const decoded = decodeQuiz(data);
      if (decoded) {
        // Prevent duplication
        if (!quizzes.find((q: any) => q.id === decoded.id)) {
          setQuizzes((prev: any) => [...prev, decoded]);
        }
        navigate(`/quiz/${decoded.id}`);
      } else {
        alert("بيانات الرابط تالفة!");
        navigate('/');
      }
    }
  }, [location, navigate, quizzes, setQuizzes]);

  return <div className="text-center py-20 font-black text-indigo-600 animate-pulse">جاري استيراد الاختبار المشترك...</div>;
};

/** --- Main App --- */

const App = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem('mq_user');
    return s ? JSON.parse(s) : { id: 'anon', name: 'Dr. Anonymous', photo: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isLoggedIn: false };
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const s = localStorage.getItem('mq_subjects');
    return s ? JSON.parse(s) : [{ id: '1', name: 'Internal Medicine', chapters: [] }];
  });

  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    const q = localStorage.getItem('mq_quizzes');
    return q ? JSON.parse(q) : [];
  });

  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    const a = localStorage.getItem('mq_attempts');
    return a ? JSON.parse(a) : [];
  });

  useEffect(() => localStorage.setItem('mq_subjects', JSON.stringify(subjects)), [subjects]);
  useEffect(() => localStorage.setItem('mq_quizzes', JSON.stringify(quizzes)), [quizzes]);
  useEffect(() => localStorage.setItem('mq_attempts', JSON.stringify(attempts)), [attempts]);
  useEffect(() => localStorage.setItem('mq_user', JSON.stringify(user)), [user]);

  const handleLogin = () => {
    // Professional Google Login Mock with persistence
    const mock = { 
      id: 'google-789', 
      name: 'د. عبدالله خالد', 
      photo: 'https://i.pravatar.cc/150?u=google-789', 
      isLoggedIn: true 
    };
    setUser(mock);
  };

  const handleLogout = () => {
    setUser({ id: 'anon', name: 'Dr. Anonymous', photo: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isLoggedIn: false });
  };

  return (
    <Router>
      <div className={`min-h-screen bg-slate-50 pb-10 overflow-x-hidden ${lang === 'ar' ? 'rtl' : ''}`}>
        <Navbar lang={lang} setLang={setLang} user={user} onLogin={handleLogin} onLogout={handleLogout} />
        <main className="container mx-auto px-6 py-10 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard strings={TRANSLATIONS[lang]} subjects={subjects} setSubjects={setSubjects} attempts={attempts} quizzes={quizzes} lang={lang} />} />
            <Route path="/create" element={<CreateQuiz strings={TRANSLATIONS[lang]} subjects={subjects} quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="/quiz/:quizId" element={<QuizInterface strings={TRANSLATIONS[lang]} setAttempts={setAttempts} quizzes={quizzes} user={user} />} />
            <Route path="/import" element={<ImportQuiz quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="/stats" element={<div className="text-center font-black py-20">قريباً: إحصائيات الأداء التفصيلية</div>} />
            <Route path="/leaderboard" element={<div className="text-center font-black py-20">قريباً: المنافسة مع الزملاء</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;

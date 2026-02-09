
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { TRANSLATIONS } from './constants';
import { Difficulty, QuestionType, User, Subject, Quiz, QuizAttempt } from './types';
import { generateQuizQuestions } from './services/geminiService';

// تهيئة الـ Worker الخاص بـ PDF.js بشكل أكثر استقراراً
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

/** --- Robust Text Extraction --- */
const extractTextFromFiles = async (files: File[]): Promise<string> => {
  let combinedText = "";
  for (const file of files) {
    if (file.type === "application/pdf") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let pdfText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          pdfText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
        }
        combinedText += pdfText;
      } catch (e) {
        console.error("PDF Extraction failed for:", file.name, e);
        throw new Error(`تعذر استخراج النص من ملف PDF: ${file.name}. قد يكون الملف محمياً أو يحتوي على صور فقط.`);
      }
    } else {
      const text = await file.text();
      combinedText += text + "\n";
    }
  }
  return combinedText.trim();
};

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
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-indigo-600 font-bold">
            {lang === 'ar' ? '→' : '←'} {strings.back}
          </button>
        )}
        <h1 onClick={() => navigate('/')} className="text-xl md:text-2xl font-black text-indigo-600 cursor-pointer flex items-center gap-2">
          <span className="text-3xl">✨</span> <span className="hidden sm:inline">{strings.title}</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="text-xs font-bold text-slate-500 hover:text-indigo-600 border px-3 py-1 rounded-full">
          {lang === 'en' ? 'العربية' : 'English'}
        </button>

        {user.isLoggedIn ? (
          <div className="flex items-center gap-3 border-l pl-4 border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{strings.welcome}</p>
              <p className="text-sm font-bold text-slate-700 leading-none">{user.name}</p>
            </div>
            <img src={user.photo} className="w-10 h-10 rounded-full border-2 border-indigo-100 shadow-sm" alt="profile" />
          </div>
        ) : null}
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

const Dashboard = ({ strings, subjects, setSubjects, attempts, quizzes, lang, user }: any) => {
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
        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
          <h2 className="text-xl font-black mb-6 flex items-center gap-2 relative z-10">📑 {strings.subjects}</h2>
          <div className="flex gap-2 mb-6 relative z-10">
            <input value={newSub} onChange={e => setNewSub(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="إضافة تصنيف..." />
            <button onClick={addSub} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl font-black text-xl">+</button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 relative z-10">
            {subjects.map((s: any) => (
              <div key={s.id} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-sm font-bold text-slate-600 hover:bg-indigo-50 transition-colors">
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </Card>
        
        <button 
          onClick={() => navigate('/create')} 
          className="w-full py-8 bg-gradient-to-br from-indigo-600 to-indigo-900 text-white rounded-[2rem] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all font-black text-xl flex flex-col items-center justify-center gap-2"
        >
          <span className="text-3xl">✨</span>
          <span>{strings.generateQuiz}</span>
        </button>
      </div>

      <div className="lg:col-span-8 space-y-8">
        <Card>
           <h2 className="text-xl font-black mb-6 flex items-center gap-2">
             📚 مكتبة الاختبارات الذكية
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {quizzes.length > 0 ? quizzes.map((q: Quiz) => (
               <div key={q.id} className="p-6 border border-slate-100 rounded-[2rem] bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all flex flex-col justify-between group">
                 <div>
                   <div className="flex justify-between items-start mb-3">
                     <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl ${
                       q.difficulty === Difficulty.VERY_HARD ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                     }`}>
                       {strings[q.difficulty as keyof typeof strings] || q.difficulty}
                     </span>
                     <button onClick={() => handleShare(q)} className="text-xs font-bold text-indigo-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">🔗 {strings.share}</button>
                   </div>
                   <h3 className="font-black text-slate-800 text-lg leading-tight line-clamp-2">{q.title}</h3>
                 </div>
                 <button onClick={() => navigate(`/quiz/${q.id}`)} className="mt-6 w-full py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                    {strings.startQuiz}
                 </button>
               </div>
             )) : (
               <div className="col-span-2 text-center py-16 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">لا توجد اختبارات.. ارفع ملفاً للبدء!</p>
               </div>
             )}
           </div>
        </Card>
      </div>
    </div>
  );
};

const CreateQuiz = ({ strings, subjects, quizzes, setQuizzes }: any) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [diff, setDiff] = useState(Difficulty.MEDIUM);
  const [type, setType] = useState(QuestionType.MIX);
  const [count, setCount] = useState(10);
  const [targetLang, setTargetLang] = useState('original');

  const handleGenerate = async () => {
    if (!files.length) return alert("الرجاء رفع الملفات أولاً");
    
    // التحقق من وجود مفتاح API مفعل
    if (typeof window.aistudio !== 'undefined') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        alert("يرجى اختيار مفتاح API أولاً لتتمكن من استخدام الذكاء الاصطناعي.");
        await window.aistudio.openSelectKey();
        // نفترض النجاح بعد فتح النافذة حسب التعليمات
      }
    }

    setLoading(true);
    setLoadingStatus("جاري استخراج النص...");
    
    try {
      const content = await extractTextFromFiles(files);
      
      if (!content || content.trim().length < 50) {
        throw new Error("النص المستخرج من الملفات غير كافٍ. تأكد أن الملف يحتوي على نصوص وليس مجرد صور.");
      }
      
      setLoadingStatus("الذكاء الاصطناعي يقوم ببناء الأسئلة...");
      const questions = await generateQuizQuestions(content, count, type, diff, targetLang as any);
      
      const newQuiz: Quiz = {
        id: Math.random().toString(36).substr(2, 9),
        title: files[0]?.name.split('.')[0] || "اختبار جديد",
        subjectId: subjects[0]?.id || '1',
        chapterId: '',
        difficulty: diff,
        questions,
        createdAt: Date.now()
      };
      
      setQuizzes([...quizzes, newQuiz]);
      navigate(`/quiz/${newQuiz.id}`);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in zoom-in duration-500">
      <Card className="p-10 !rounded-[3.5rem] shadow-2xl border-t-8 border-indigo-600">
        <h2 className="text-3xl font-black text-center mb-10 text-slate-800">{strings.generateQuiz}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="border-4 border-dashed border-indigo-50 rounded-[2.5rem] p-12 text-center bg-indigo-50/20 hover:bg-indigo-50 transition-all relative group cursor-pointer">
              <input type="file" multiple accept=".pdf,.txt" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFiles(Array.from(e.target.files || []))} />
              <div className="text-7xl mb-4 group-hover:scale-110 transition-transform">📁</div>
              <p className="font-black text-indigo-600 text-lg">{strings.uploadFiles}</p>
              <p className="text-xs text-slate-400 mt-2 font-bold">{files.length > 0 ? `${files.length} ملفات جاهزة` : 'PDF أو نصوص'}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase px-2">{strings.difficulty}</label>
              <div className="grid grid-cols-2 gap-2">
                {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.VERY_HARD].map(d => (
                  <button key={d} onClick={() => setDiff(d)} className={`py-4 rounded-xl font-black text-[11px] uppercase transition-all ${diff === d ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    {strings[d as keyof typeof strings] || d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase px-2">نوع الأسئلة</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none">
                  <option value={QuestionType.MCQ}>{strings.mcq}</option>
                  <option value={QuestionType.TRUE_FALSE}>{strings.tf}</option>
                  <option value={QuestionType.MIX}>{strings.mix}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase px-2">عدد الأسئلة</label>
                <input type="number" min="1" max="100" value={count} onChange={e => setCount(Number(e.target.value))} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-center text-xl outline-none" />
              </div>
            </div>
          </div>
        </div>
        <button 
          onClick={handleGenerate} 
          disabled={loading || files.length === 0} 
          className="w-full mt-12 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-2xl disabled:opacity-50 transition-all hover:bg-indigo-700 active:scale-95 flex flex-col items-center justify-center"
        >
          {loading ? (
            <>
              <span className="animate-pulse">{loadingStatus}</span>
              <span className="text-xs font-normal mt-2 opacity-70 italic">هذه العملية تتم عبر Gemini 3 الذكي</span>
            </>
          ) : strings.generateQuiz}
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
        <Card className="text-center p-16 !rounded-[4rem] border-t-8 border-indigo-600 shadow-2xl relative overflow-hidden">
          <div className="text-8xl mb-6">🏆</div>
          <h2 className="text-4xl font-black mb-10 text-slate-800">{strings.results}</h2>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="p-8 bg-white shadow-sm border border-slate-100 rounded-[2.5rem]"><p className="text-6xl font-black text-indigo-600">{score}/{quiz.questions.length}</p><p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-2">{strings.score}</p></div>
            <div className="p-8 bg-white shadow-sm border border-slate-100 rounded-[2.5rem]"><p className="text-6xl font-black text-indigo-600">{Math.round((Date.now()-start)/1000)}ث</p><p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-2">الوقت</p></div>
          </div>
          <button onClick={() => navigate('/')} className="px-16 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">العودة للرئيسية</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8 sticky top-20 z-40 bg-slate-50/90 backdrop-blur-md py-4 px-2">
        <div className="flex justify-between items-center font-black text-xs text-indigo-600 mb-3 uppercase tracking-widest px-2">
          <span>سؤال {cur+1} / {quiz.questions.length}</span>
          <span className="px-3 py-1 bg-indigo-100 rounded-xl">{strings[quiz.difficulty as keyof typeof strings] || quiz.difficulty}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-3 bg-white rounded-full overflow-hidden shadow-inner border border-slate-200">
          <div className="h-full bg-indigo-600 transition-all duration-700 rounded-full" style={{width: `${progress}%`}} />
        </div>
      </div>

      <Card className="p-10 md:p-16 !rounded-[4rem] relative shadow-2xl">
        <h3 className="text-2xl md:text-3xl font-black mb-14 text-slate-800 leading-tight">{current.text}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(current.options || []).map((opt, i) => {
             const isSel = ans[current.id] === opt;
             const isCorr = opt === current.correctAnswer;
             let style = "border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-indigo-100";
             if (showExpl) {
               if (isCorr) style = "bg-emerald-500 border-emerald-500 text-white shadow-lg";
               else if (isSel) style = "bg-rose-500 border-rose-500 text-white shadow-lg";
               else style = "opacity-40 grayscale pointer-events-none";
             } else if (isSel) {
               style = "bg-indigo-600 border-indigo-600 text-white scale-105 shadow-xl";
             }

             return (
               <button key={i} onClick={() => onAnswer(opt)} className={`p-8 rounded-[2.5rem] border-2 font-black transition-all text-right flex items-center gap-5 ${style}`}>
                 <span className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center font-black text-xl ${isSel || (showExpl && isCorr) ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                   {String.fromCharCode(65+i)}
                 </span>
                 <span className="text-lg md:text-xl">{opt}</span>
               </button>
             );
          })}
        </div>

        {showExpl && (
          <div className="mt-12 p-10 bg-indigo-50 rounded-[3rem] border border-indigo-100 animate-in slide-in-from-top-4 duration-500">
             <h4 className="font-black text-indigo-800 mb-3 flex items-center gap-2 text-lg">💡 الشرح:</h4>
             <p className="text-indigo-900/70 font-bold leading-relaxed text-lg">{current.explanation}</p>
          </div>
        )}

        <div className="mt-20 flex justify-between items-center">
          <button onClick={() => navigate('/')} className="text-slate-400 font-black hover:text-rose-500 transition-colors uppercase text-[10px] tracking-widest">إنهاء الجلسة</button>
          <button onClick={onNext} disabled={!ans[current.id]} className="px-16 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 disabled:opacity-20 transition-all flex items-center gap-3">
            {cur === quiz.questions.length - 1 ? strings.finish : strings.next}
            <span className="text-xl">➜</span>
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

  return <div className="text-center py-24 font-black text-indigo-600 animate-pulse text-2xl">جاري استيراد الاختبار...</div>;
};

/** --- Main App --- */

const App = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [user, setUser] = useState({ id: 'anon', name: 'Anonymous User', photo: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isLoggedIn: false });
  const [subjects, setSubjects] = useState<Subject[]>([{ id: '1', name: 'عام', chapters: [] }]);
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    const q = localStorage.getItem('mq_quizzes');
    return q ? JSON.parse(q) : [];
  });
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    const a = localStorage.getItem('mq_attempts');
    return a ? JSON.parse(a) : [];
  });

  useEffect(() => localStorage.setItem('mq_quizzes', JSON.stringify(quizzes)), [quizzes]);
  useEffect(() => localStorage.setItem('mq_attempts', JSON.stringify(attempts)), [attempts]);

  return (
    <Router>
      <div className={`min-h-screen bg-slate-50 pb-20 overflow-x-hidden ${lang === 'ar' ? 'rtl' : ''}`}>
        <Navbar lang={lang} setLang={setLang} user={user} onLogin={() => {}} onLogout={() => {}} />
        <main className="container mx-auto px-6 py-10 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard strings={TRANSLATIONS[lang]} subjects={subjects} setSubjects={setSubjects} attempts={attempts} quizzes={quizzes} lang={lang} user={user} />} />
            <Route path="/create" element={<CreateQuiz strings={TRANSLATIONS[lang]} subjects={subjects} quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="/quiz/:quizId" element={<QuizInterface strings={TRANSLATIONS[lang]} setAttempts={setAttempts} quizzes={quizzes} user={user} />} />
            <Route path="/import" element={<ImportQuiz quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="/stats" element={<div className="text-center font-black py-20 text-slate-300 text-3xl">📊 قريباً: الإحصائيات</div>} />
            <Route path="/leaderboard" element={<div className="text-center font-black py-20 text-slate-300 text-3xl">🏆 قريباً: لوحة المتصدرين</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;

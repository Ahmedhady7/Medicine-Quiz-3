
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { TRANSLATIONS } from './constants';
import { Difficulty, QuestionType, User, Subject, Quiz, QuizAttempt } from './types';
import { generateQuizQuestions } from './services/geminiService';

// إعداد عامل الـ PDF بشكل صحيح
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
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          pdfText += pageText + "\n";
        }
        combinedText += pdfText;
      } catch (e) {
        console.error("PDF Error:", file.name, e);
        throw new Error(`تعذر قراءة ملف PDF: ${file.name}. تأكد أنه ليس محمياً بكلمة سر.`);
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

const Navbar = ({ lang, setLang, user }: any) => {
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
        {user.isLoggedIn && (
           <div className="flex items-center gap-2 border-l pl-4">
             <span className="text-sm font-bold hidden sm:inline">{user.name}</span>
             <img src={user.photo} className="w-8 h-8 rounded-full border shadow-sm" alt="P" />
           </div>
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

const Dashboard = ({ strings, attempts, quizzes, user }: any) => {
  const navigate = useNavigate();

  const handleShare = (quiz: Quiz) => {
    const code = encodeQuiz(quiz);
    const url = `${window.location.origin}${window.location.pathname}#/import?data=${code}`;
    navigator.clipboard.writeText(url);
    alert(strings.copySuccess);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white relative overflow-hidden group">
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-4">أهلاً بك في كويز برو الذكي!</h2>
            <p className="text-indigo-100 font-bold mb-8">حول أي ملف دراسي إلى اختبار تفاعلي في ثوانٍ معدودة.</p>
            <button onClick={() => navigate('/create')} className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">ابدأ التوليد الآن ✨</button>
          </div>
          <div className="absolute -bottom-10 -right-10 text-9xl opacity-20 group-hover:rotate-12 transition-transform">📚</div>
        </Card>
      </div>

      <Card>
        <h3 className="text-xl font-black mb-6 flex items-center gap-2">📂 مكتبة اختباراتي</h3>
        {quizzes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((q: Quiz) => (
              <div key={q.id} className="p-5 border rounded-3xl bg-slate-50 hover:bg-white hover:shadow-lg transition-all flex flex-col justify-between border-slate-100 group">
                <div>
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[10px] font-black uppercase px-2 py-1 bg-white rounded-lg border">{strings[q.difficulty as keyof typeof strings]}</span>
                     <button onClick={() => handleShare(q)} className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">🔗</button>
                   </div>
                   <h4 className="font-black text-slate-800 line-clamp-2">{q.title}</h4>
                </div>
                <button onClick={() => navigate(`/quiz/${q.id}`)} className="mt-4 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-colors">دخول الاختبار</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 font-bold italic">لا توجد اختبارات محفوظة.. ابدأ برفع أول ملف لك!</div>
        )}
      </Card>
    </div>
  );
};

const CreateQuiz = ({ strings, quizzes, setQuizzes }: any) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [diff, setDiff] = useState(Difficulty.MEDIUM);
  const [type, setType] = useState(QuestionType.MIX);
  const [count, setCount] = useState(10);

  const handleGenerate = async () => {
    if (!files.length) return alert("الرجاء رفع ملف أولاً");
    
    setLoading(true);
    setLoadingStatus("جاري قراءة الملف...");
    
    try {
      const content = await extractTextFromFiles(files);
      
      if (!content || content.length < 20) {
        throw new Error("لم يتم العثور على نص كافٍ في الملف. تأكد أن الملف يحتوي على نصوص مقروءة.");
      }
      
      setLoadingStatus("الذكاء الاصطناعي يقوم بالتوليد...");
      const questions = await generateQuizQuestions(content, count, type, diff, 'original');
      
      const newQuiz: Quiz = {
        id: Math.random().toString(36).substr(2, 9),
        title: files[0]?.name.split('.')[0] || "اختبار ذكي",
        subjectId: '1',
        chapterId: '',
        difficulty: diff,
        questions,
        createdAt: Date.now()
      };
      
      setQuizzes([...quizzes, newQuiz]);
      navigate(`/quiz/${newQuiz.id}`);
    } catch (e: any) {
      console.error(e);
      if (e.message === "API_KEY_ERROR") {
        // إذا كان هناك خطأ في المفتاح، نفتح نافذة الاختيار فوراً
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
        } else {
          alert("يرجى التأكد من إعداد مفتاح API صالح.");
        }
      } else {
        alert(e.message || "حدث خطأ غير متوقع.");
      }
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in zoom-in duration-500">
      <Card className="p-8 md:p-12 !rounded-[3rem] shadow-2xl border-t-8 border-indigo-600">
        <h2 className="text-3xl font-black text-center mb-10 text-slate-800">توليد اختبار ذكي 🤖</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="border-4 border-dashed border-slate-100 rounded-3xl p-10 text-center bg-slate-50 hover:bg-white hover:border-indigo-200 transition-all cursor-pointer relative group">
              <input type="file" multiple accept=".pdf,.txt" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFiles(Array.from(e.target.files || []))} />
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📄</div>
              <p className="font-black text-slate-600">{files.length > 0 ? `${files.length} ملفات جاهزة` : strings.uploadFiles}</p>
              <p className="text-[10px] text-slate-400 mt-2">PDF أو نصوص فقط</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase">الصعوبة</label>
              <div className="grid grid-cols-2 gap-2">
                {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.VERY_HARD].map(d => (
                  <button key={d} onClick={() => setDiff(d)} className={`py-3 rounded-xl font-bold text-[10px] transition-all ${diff === d ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                    {strings[d as keyof typeof strings] || d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">العدد</label>
                <input type="number" value={count} onChange={e => setCount(Math.min(50, Math.max(1, Number(e.target.value))))} className="w-full p-3 bg-slate-50 rounded-xl font-black text-center border-none outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">النوع</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-3 bg-slate-50 rounded-xl font-black text-xs border-none outline-none">
                  <option value={QuestionType.MCQ}>{strings.mcq}</option>
                  <option value={QuestionType.TRUE_FALSE}>{strings.tf}</option>
                  <option value={QuestionType.MIX}>{strings.mix}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleGenerate} 
          disabled={loading || files.length === 0} 
          className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 flex flex-col items-center justify-center"
        >
          {loading ? (
            <>
              <span className="animate-pulse">{loadingStatus}</span>
              <span className="text-[10px] font-normal opacity-70 mt-1">يتم التوليد بواسطة Gemini 3 الذكي</span>
            </>
          ) : "ابدأ التوليد السحري ✨"}
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

  if (!quiz) return <div className="text-center py-20 font-black text-slate-300 italic">الاختبار غير موجود..</div>;

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
        <Card className="text-center p-12 !rounded-[4rem] border-t-8 border-indigo-600 shadow-2xl">
          <div className="text-7xl mb-6">🏆</div>
          <h2 className="text-4xl font-black mb-8 text-slate-800">{strings.results}</h2>
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="p-6 bg-slate-50 rounded-3xl"><p className="text-5xl font-black text-indigo-600">{score}/{quiz.questions.length}</p><p className="text-slate-400 font-bold text-xs mt-2">{strings.score}</p></div>
            <div className="p-6 bg-slate-50 rounded-3xl"><p className="text-5xl font-black text-indigo-600">{Math.round((Date.now()-start)/1000)}ث</p><p className="text-slate-400 font-bold text-xs mt-2">الوقت</p></div>
          </div>
          <button onClick={() => navigate('/')} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-all">العودة للرئيسية</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8 sticky top-20 z-40 bg-slate-50/90 backdrop-blur-md py-4 px-2">
        <div className="flex justify-between items-center font-black text-xs text-indigo-600 mb-2 px-2">
          <span>{cur+1} / {quiz.questions.length}</span>
          <span className="bg-indigo-100 px-3 py-1 rounded-full">{strings[quiz.difficulty as keyof typeof strings]}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-white rounded-full overflow-hidden shadow-inner">
          <div className="h-full bg-indigo-600 transition-all duration-500" style={{width: `${progress}%`}} />
        </div>
      </div>

      <Card className="p-8 md:p-12 !rounded-[3rem] shadow-xl">
        <h3 className="text-xl md:text-2xl font-black mb-10 text-slate-800 leading-snug">{current.text}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(current.options || []).map((opt, i) => {
             const isSel = ans[current.id] === opt;
             const isCorr = opt === current.correctAnswer;
             let style = "border-slate-100 text-slate-600 hover:bg-slate-50";
             if (showExpl) {
               if (isCorr) style = "bg-emerald-500 border-emerald-500 text-white shadow-lg";
               else if (isSel) style = "bg-rose-500 border-rose-500 text-white shadow-lg";
               else style = "opacity-40 grayscale pointer-events-none";
             } else if (isSel) {
               style = "bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]";
             }

             return (
               <button key={i} onClick={() => onAnswer(opt)} className={`p-6 rounded-3xl border-2 font-black transition-all text-right flex items-center gap-4 ${style}`}>
                 <span className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center font-black ${isSel || (showExpl && isCorr) ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                   {String.fromCharCode(65+i)}
                 </span>
                 <span className="text-sm md:text-base">{opt}</span>
               </button>
             );
          })}
        </div>

        {showExpl && (
          <div className="mt-8 p-8 bg-indigo-50 rounded-3xl border border-indigo-100 animate-in slide-in-from-top-2 duration-300">
             <h4 className="font-black text-indigo-800 mb-2 flex items-center gap-2">💡 الشرح:</h4>
             <p className="text-indigo-900/70 font-bold leading-relaxed">{current.explanation}</p>
          </div>
        )}

        <div className="mt-16 flex justify-between items-center border-t pt-8">
          <button onClick={() => navigate('/')} className="text-slate-400 font-bold hover:text-rose-500 transition-colors text-xs">إلغاء الاختبار</button>
          <button onClick={onNext} disabled={!ans[current.id]} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-black disabled:opacity-20 transition-all flex items-center gap-2">
            {cur === quiz.questions.length - 1 ? strings.finish : strings.next}
            <span>➜</span>
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
        alert("الرابط تالف!");
        navigate('/');
      }
    }
  }, [location, navigate, quizzes, setQuizzes]);

  return <div className="text-center py-24 font-black text-indigo-600 animate-pulse">جاري استيراد الاختبار...</div>;
};

/** --- Main App --- */

const App = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [user] = useState({ id: 'anon', name: 'مستخدم مجهول', photo: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isLoggedIn: true });
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    const q = localStorage.getItem('mq_quizzes_v2');
    return q ? JSON.parse(q) : [];
  });
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    const a = localStorage.getItem('mq_attempts_v2');
    return a ? JSON.parse(a) : [];
  });

  useEffect(() => localStorage.setItem('mq_quizzes_v2', JSON.stringify(quizzes)), [quizzes]);
  useEffect(() => localStorage.setItem('mq_attempts_v2', JSON.stringify(attempts)), [attempts]);

  return (
    <Router>
      <div className={`min-h-screen bg-slate-50 pb-20 overflow-x-hidden ${lang === 'ar' ? 'rtl' : ''}`}>
        <Navbar lang={lang} setLang={setLang} user={user} />
        <main className="container mx-auto px-4 md:px-6 py-8 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard strings={TRANSLATIONS[lang]} attempts={attempts} quizzes={quizzes} lang={lang} user={user} />} />
            <Route path="/create" element={<CreateQuiz strings={TRANSLATIONS[lang]} quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="/quiz/:quizId" element={<QuizInterface strings={TRANSLATIONS[lang]} setAttempts={setAttempts} quizzes={quizzes} user={user} />} />
            <Route path="/import" element={<ImportQuiz quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="*" element={<div className="text-center py-20 font-black">الصفحة غير موجودة!</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;

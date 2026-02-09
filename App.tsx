
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import * as pdfjsLib from 'pdfjs-dist';
import { TRANSLATIONS } from './constants';
import { Difficulty, QuestionType, User, Subject, Quiz, QuizAttempt } from './types';
import { generateQuizQuestions } from './services/geminiService';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

/** --- Utility for PDF Extraction --- */
const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }
  
  return fullText;
};

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
            <button onClick={onLogout} className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase">{strings.logout}</button>
          </div>
        ) : (
          <button onClick={onLogin} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-full shadow-lg hover:shadow-indigo-200 transition-all active:scale-95 text-sm font-black">
            دخول / إنشاء حساب
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

const LoginModal = ({ isOpen, onClose, onLogin }: any) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    role: 'طالب',
    institution: '',
    email: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      setStep(step + 1);
    } else {
      onLogin(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
          <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${(step / 2) * 100}%` }}></div>
        </div>
        
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{step === 1 ? '👤' : '🏫'}</div>
          <h2 className="text-3xl font-black text-slate-800">
            {step === 1 ? 'الملف الشخصي' : 'معلوماتك'}
          </h2>
          <p className="text-slate-400 font-bold mt-2">أدخل بياناتك لإنشاء حسابك الذكي</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase px-2">الاسم بالكامل</label>
                <input 
                  required
                  type="text" 
                  placeholder="مثال: أحمد محمد علي" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase px-2">البريد الإلكتروني</label>
                <input 
                  type="email" 
                  placeholder="example@email.com" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase px-2">المستوى الدراسي / المهني</label>
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option>طالب</option>
                  <option>معلم / أستاذ</option>
                  <option>باحث</option>
                  <option>موظف / مهني</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase px-2">المؤسسة / المدرسة</label>
                <input 
                  required
                  type="text" 
                  placeholder="مثال: جامعة الملك سعود" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  value={formData.institution}
                  onChange={(e) => setFormData({...formData, institution: e.target.value})}
                />
              </div>
            </>
          )}

          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <button 
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-lg transition-all"
              >
                السابق
              </button>
            )}
            <button 
              type="submit"
              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all"
            >
              {step === 1 ? 'التالي' : 'إتمام التسجيل'}
            </button>
          </div>
          <button type="button" onClick={onClose} className="w-full text-slate-400 font-bold text-sm mt-4">إلغاء</button>
        </form>
      </div>
    </div>
  );
};

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
                <span className="text-[10px] bg-white px-2 py-1 rounded-full border">{s.chapters.length} Ch</span>
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
             📚 {user.isLoggedIn ? `مكتبة ${user.name}` : 'الاختبارات المتاحة'}
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {quizzes.length > 0 ? quizzes.map((q: Quiz) => (
               <div key={q.id} className="p-6 border border-slate-100 rounded-[2rem] bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all flex flex-col justify-between group">
                 <div>
                   <div className="flex justify-between items-start mb-3">
                     <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl ${
                       q.difficulty === Difficulty.VERY_HARD ? 'bg-rose-100 text-rose-700' :
                       q.difficulty === Difficulty.HARD ? 'bg-orange-100 text-orange-700' :
                       q.difficulty === Difficulty.MEDIUM ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
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
                  <div className="text-5xl mb-4">📖</div>
                  <p className="text-slate-400 font-bold italic">لا توجد اختبارات حالياً.. ابدأ بإنشاء واحد!</p>
               </div>
             )}
           </div>
        </Card>

        <div className="grid grid-cols-2 gap-6">
          <button onClick={() => navigate('/stats')} className="p-10 bg-white border border-slate-100 rounded-[3rem] flex flex-col items-center gap-4 hover:shadow-2xl transition-all group">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">📊</div>
            <span className="font-black text-slate-700 text-lg">{strings.stats}</span>
          </button>
          <button onClick={() => navigate('/leaderboard')} className="p-10 bg-white border border-slate-100 rounded-[3rem] flex flex-col items-center gap-4 hover:shadow-2xl transition-all group">
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🏆</div>
            <span className="font-black text-slate-700 text-lg">{strings.leaderboard}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateQuiz = ({ strings, subjects, quizzes, setQuizzes }: any) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [subId, setSubId] = useState(subjects[0]?.id || '');
  const [diff, setDiff] = useState(Difficulty.MEDIUM);
  const [type, setType] = useState(QuestionType.MIX);
  const [count, setCount] = useState(10);
  const [targetLang, setTargetLang] = useState('original');

  const handleGenerate = async () => {
    if (!files.length) return alert("الرجاء رفع الملفات أولاً");
    setLoading(true);
    setLoadingStatus("جاري استخراج النص من الملفات...");
    try {
      let content = "";
      for (const f of files) {
        if (f.type === "application/pdf") {
          content += await extractTextFromPdf(f) + "\n";
        } else {
          content += await f.text() + "\n";
        }
      }
      
      setLoadingStatus("الذكاء الاصطناعي يقوم ببناء الأسئلة من المحتوى...");
      const questions = await generateQuizQuestions(content, count, type, diff, targetLang as any);
      
      const newQuiz: Quiz = {
        id: Math.random().toString(36).substr(2, 9),
        title: files[0]?.name.split('.')[0] || "توليد ذكي",
        subjectId: subId,
        chapterId: '',
        difficulty: diff,
        questions,
        createdAt: Date.now()
      };
      
      setQuizzes([...quizzes, newQuiz]);
      navigate(`/quiz/${newQuiz.id}`);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "حدث خطأ أثناء معالجة الملفات. تأكد من جودة النص في الملفات المرفوعة.");
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
              <p className="text-xs text-slate-400 mt-2 font-bold">{files.length > 0 ? `${files.length} ملفات جاهزة` : 'يدعم PDF و TXT لأي محتوى'}</p>
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">تصنيف الاختبار</label>
               <select value={subId} onChange={e => setSubId(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none text-slate-600 shadow-inner">
                 {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{strings.difficulty}</label>
              <div className="grid grid-cols-2 gap-2">
                {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.VERY_HARD].map(d => (
                  <button key={d} onClick={() => setDiff(d)} className={`py-4 rounded-xl font-black text-[11px] uppercase transition-all ${diff === d ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    {strings[d as keyof typeof strings] || d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">نوع الأسئلة</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none">
                  <option value={QuestionType.MCQ}>{strings.mcq}</option>
                  <option value={QuestionType.TRUE_FALSE}>{strings.tf}</option>
                  <option value={QuestionType.MIX}>{strings.mix}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">عدد الأسئلة</label>
                <input type="number" min="1" max="100" value={count} onChange={e => setCount(Number(e.target.value))} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-center text-xl outline-none" />
              </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">لغة الاختبار</label>
               <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                 {['original', 'ar', 'en'].map(l => (
                   <button key={l} onClick={() => setTargetLang(l)} className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase transition-all ${targetLang === l ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>
                     {strings[l as keyof typeof strings] || l}
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </div>
        <button 
          onClick={handleGenerate} 
          disabled={loading || !subId || files.length === 0} 
          className="w-full mt-12 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-2xl shadow-indigo-200 disabled:opacity-50 transition-all hover:bg-indigo-700 active:scale-95 flex flex-col items-center justify-center"
        >
          {loading ? (
            <>
              <span className="animate-pulse">{loadingStatus}</span>
              <span className="text-xs font-normal mt-2 opacity-70 italic">هذه العملية تتم بقوة Gemini 3 الذكي</span>
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
          <div className="absolute inset-0 bg-indigo-50 opacity-10 pointer-events-none"></div>
          <div className="text-8xl mb-6 relative">🏆</div>
          <h2 className="text-4xl font-black mb-10 text-slate-800 relative">{strings.results}</h2>
          <div className="grid grid-cols-2 gap-8 mb-12 relative">
            <div className="p-8 bg-white shadow-sm border border-slate-100 rounded-[2.5rem]"><p className="text-6xl font-black text-indigo-600">{score}/{quiz.questions.length}</p><p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-2">{strings.score}</p></div>
            <div className="p-8 bg-white shadow-sm border border-slate-100 rounded-[2.5rem]"><p className="text-6xl font-black text-indigo-600">{Math.round((Date.now()-start)/1000)}ث</p><p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-2">الوقت</p></div>
          </div>
          <button onClick={() => navigate('/')} className="relative px-16 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">العودة للرئيسية</button>
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

  return <div className="text-center py-24 font-black text-indigo-600 animate-pulse text-2xl">جاري استيراد الاختبار المشترك...</div>;
};

/** --- Main App --- */

const App = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem('mq_user');
    return s ? JSON.parse(s) : { id: 'anon', name: 'Anonymous User', photo: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isLoggedIn: false };
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const s = localStorage.getItem('mq_subjects');
    return s ? JSON.parse(s) : [
      { id: '1', name: 'العلوم العامة', chapters: [] },
      { id: '2', name: 'اللغات والآداب', chapters: [] },
      { id: '3', name: 'التكنولوجيا', chapters: [] }
    ];
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

  const handleLogin = (data: any) => {
    const newUser = { 
      id: 'user-' + Date.now(), 
      name: data.name, 
      photo: `https://i.pravatar.cc/150?u=${data.name}`, 
      isLoggedIn: true,
      role: data.role,
      institution: data.institution
    };
    setUser(newUser);
    setLoginModalOpen(false);
  };

  const handleLogout = () => {
    if (window.confirm('هل تريد تسجيل الخروج؟')) {
      setUser({ id: 'anon', name: 'Anonymous User', photo: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isLoggedIn: false });
    }
  };

  return (
    <Router>
      <div className={`min-h-screen bg-slate-50 pb-20 overflow-x-hidden ${lang === 'ar' ? 'rtl' : ''}`}>
        <Navbar lang={lang} setLang={setLang} user={user} onLogin={() => setLoginModalOpen(true)} onLogout={handleLogout} />
        <main className="container mx-auto px-6 py-10 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard strings={TRANSLATIONS[lang]} subjects={subjects} setSubjects={setSubjects} attempts={attempts} quizzes={quizzes} lang={lang} user={user} />} />
            <Route path="/create" element={<CreateQuiz strings={TRANSLATIONS[lang]} subjects={subjects} quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="/quiz/:quizId" element={<QuizInterface strings={TRANSLATIONS[lang]} setAttempts={setAttempts} quizzes={quizzes} user={user} />} />
            <Route path="/import" element={<ImportQuiz quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="/stats" element={<div className="text-center font-black py-20 text-slate-300 text-3xl">قريباً: تحليلات الأداء المتقدمة 📊</div>} />
            <Route path="/leaderboard" element={<div className="text-center font-black py-20 text-slate-300 text-3xl">قريباً: لوحة المتصدرين العالمية 🏆</div>} />
          </Routes>
        </main>
        <LoginModal 
          isOpen={isLoginModalOpen} 
          onClose={() => setLoginModalOpen(false)} 
          onLogin={handleLogin} 
        />
      </div>
    </Router>
  );
};

export default App;

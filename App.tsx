
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";

/** --- الإعدادات والأنواع --- */
enum Difficulty { EASY = 'easy', MEDIUM = 'medium', HARD = 'hard' }
enum QuestionType { MCQ = 'mcq', TRUE_FALSE = 'true_false', MIX = 'mix' }

interface Question {
  id: string;
  text: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  type: QuestionType;
}

interface Quiz {
  id: string;
  title: string;
  subjectId: string;
  chapterId: string;
  difficulty: Difficulty;
  questions: Question[];
  createdAt: number;
}

interface Chapter { id: string; name: string; }
interface Subject { id: string; name: string; chapters: Chapter[]; }
interface QuizAttempt {
  id: string; quizId: string; userId: string; userName: string;
  score: number; totalQuestions: number; timeSpent: number; date: number;
}

const TRANSLATIONS = {
  en: {
    title: 'Medicine Quiz Pro', uploadFiles: 'Upload Content', generateQuiz: 'Create Quiz',
    subjects: 'Subjects', chapters: 'Chapters', stats: 'My Stats', leaderboard: 'Top Doctors',
    difficulty: 'Level', easy: 'Basic', medium: 'Clinical', hard: 'Specialist',
    mcq: 'MCQ', tf: 'True/False', mix: 'Mixed Mode', questionCount: 'Qty',
    results: 'Medical Report', share: 'Copy Link', score: 'Final Score',
    time: 'Duration', translate: 'Output Language', toArabic: 'Arabic',
    toEnglish: 'English', original: 'Source Lang', next: 'Next Step', finish: 'Complete'
  },
  ar: {
    title: 'أكاديمية الاختبارات الطبية', uploadFiles: 'رفع المحتوى الطبي', generateQuiz: 'إنشاء الاختبار بالذكاء الاصطناعي',
    subjects: 'المواد', chapters: 'الفصول', stats: 'إحصائياتي', leaderboard: 'لوحة الأوائل',
    difficulty: 'المستوى', easy: 'تأسيسي', medium: 'إكلينيكي', hard: 'تخصصي',
    mcq: 'اختيار من متعدد', tf: 'صح وخطأ', mix: 'نمط مختلط', questionCount: 'العدد',
    results: 'التقرير الطبي للنتائج', share: 'نسخ رابط الاختبار', score: 'الدرجة النهائية',
    time: 'الوقت المستغرق', translate: 'لغة الأسئلة', toArabic: 'العربية',
    toEnglish: 'الإنجليزية', original: 'نفس لغة المصدر', next: 'السؤال التالي', finish: 'إنهاء الاختبار'
  }
};

/** --- خدمة الذكاء الاصطناعي --- */
const generateQuestionsAI = async (
  content: string, count: number, type: QuestionType, 
  difficulty: Difficulty, lang: string
): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `You are a Senior Medical Examiner. Create ${count} ${difficulty} level ${type} questions based on the provided medical text.
    Target Language: ${lang === 'original' ? 'Same as source' : lang}.
    Ensure absolute medical accuracy.
    Format your response as a JSON array of objects with fields: id, text, options (array of 4 if MCQ, 2 if T/F), correctAnswer (must match one option exactly), explanation (deep clinical insight).
    Text: ${content.substring(0, 40000)}`;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["id", "text", "correctAnswer", "explanation"]
          }
        }
      }
    });
    return JSON.parse(res.text || '[]');
  } catch (e) {
    console.error("AI Error:", e);
    throw e;
  }
};

/** --- المكونات الفرعية --- */

const Navbar = ({ lang, setLang, strings }: any) => {
  const navigate = useNavigate();
  return (
    <nav className={`bg-white/80 backdrop-blur-md shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-50 border-b border-indigo-50 ${lang === 'ar' ? 'rtl' : ''}`}>
      <h1 onClick={() => navigate('/')} className="text-2xl font-black text-indigo-600 cursor-pointer flex items-center gap-2 hover:opacity-80 transition-all">
        <span className="text-3xl">⚕️</span> {strings.title}
      </h1>
      <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="px-6 py-2 bg-indigo-600 text-white rounded-full font-bold text-sm shadow-lg shadow-indigo-100 transition-transform active:scale-95">
        {lang === 'en' ? 'العربية' : 'English'}
      </button>
    </nav>
  );
};

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all ${className}`}>
    {children}
  </div>
);

/** --- الواجهات الأساسية --- */

const Dashboard = ({ strings, subjects, setSubjects, attempts, lang }: any) => {
  const navigate = useNavigate();
  const [newSub, setNewSub] = useState('');

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubjects([...subjects, { id: Date.now().toString(), name: newSub, chapters: [] }]);
    setNewSub('');
  };

  const scoreAvg = attempts.length 
    ? Math.round(attempts.reduce((a:any, b:any) => a + (b.score/b.totalQuestions), 0) / attempts.length * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
      <div className="lg:col-span-4 space-y-6">
        <Card>
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">📑 {strings.subjects}</h2>
          <div className="flex gap-2 mb-6">
            <input 
              value={newSub} 
              onChange={e => setNewSub(e.target.value)} 
              className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="اسم المادة..." 
            />
            <button onClick={addSub} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center text-xl">+</button>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {subjects.map((s: any) => (
              <div key={s.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center group hover:bg-indigo-50 transition-colors">
                <span className="font-bold text-slate-700">{s.name}</span>
                <span className="text-[10px] bg-white px-3 py-1 rounded-full border border-slate-200 text-slate-400 font-bold">{s.chapters.length} Ch</span>
              </div>
            ))}
          </div>
        </Card>
        
        <button 
          onClick={() => navigate('/create')} 
          className="w-full py-6 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-[2rem] shadow-2xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all font-black text-xl"
        >
          ✨ {strings.generateQuiz}
        </button>
      </div>

      <div className="lg:col-span-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="الاختبارات" value={attempts.length} icon="📝" color="bg-blue-500" />
          <StatCard label="متوسط الأداء" value={scoreAvg + '%'} icon="🎯" color="bg-emerald-500" />
          <StatCard label="وقت المذاكرة" value={attempts.reduce((a:any, b:any) => a + b.timeSpent, 0) + ' د'} icon="⏱️" color="bg-amber-500" />
        </div>
        
        <Card className="p-10">
          <h2 className="text-2xl font-black mb-8 flex items-center gap-3">🚀 اختصارات سريعة</h2>
          <div className="grid grid-cols-2 gap-6">
            <NavBtn onClick={() => navigate('/stats')} icon="📊" label={strings.stats} />
            <NavBtn onClick={() => navigate('/leaderboard')} icon="🏆" label={strings.leaderboard} />
          </div>
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => (
  <Card className="flex items-center justify-between group">
    <div>
      <p className="text-slate-400 text-xs font-bold uppercase mb-1 tracking-widest">{label}</p>
      <p className="text-3xl font-black text-slate-800">{value}</p>
    </div>
    <div className={`w-16 h-16 rounded-3xl ${color} bg-opacity-10 flex items-center justify-center text-3xl group-hover:rotate-12 transition-transform`}>{icon}</div>
  </Card>
);

const NavBtn = ({ onClick, icon, label }: any) => (
  <button onClick={onClick} className="p-10 border-2 border-slate-50 rounded-[2.5rem] hover:border-indigo-100 hover:bg-indigo-50 transition-all flex flex-col items-center gap-4 group">
    <span className="text-4xl group-hover:scale-125 transition-transform">{icon}</span>
    <span className="font-black text-slate-700">{label}</span>
  </button>
);

const CreateQuiz = ({ strings, subjects, lang }: any) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [subId, setSubId] = useState(subjects[0]?.id || '');
  const [diff, setDiff] = useState(Difficulty.MEDIUM);
  const [type, setType] = useState(QuestionType.MIX);
  const [count, setCount] = useState(20);
  const [targetLang, setTargetLang] = useState('original');

  const handleGenerate = async () => {
    if (!files.length) return alert("الرجاء رفع الملفات أولاً");
    setLoading(true);
    try {
      let text = "";
      for (const f of files) text += await f.text() + "\n";
      const questions = await generateQuestionsAI(text, count, type, diff, targetLang);
      const quizId = Math.random().toString(36).substr(2, 9);
      const newQuiz: Quiz = {
        id: quizId, title: "اختبار طبي ذكي", subjectId: subId, chapterId: '', 
        difficulty: diff, questions, createdAt: Date.now()
      };
      const saved = JSON.parse(localStorage.getItem('mq_quizzes') || '[]');
      saved.push(newQuiz);
      localStorage.setItem('mq_quizzes', JSON.stringify(saved));
      navigate(`/quiz/${quizId}`);
    } catch (e) {
      alert("فشل إنشاء الأسئلة. تأكد من جودة المحتوى المرفوع.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in zoom-in duration-500">
      <Card className="p-12 !rounded-[3rem] shadow-2xl">
        <h2 className="text-3xl font-black text-center mb-12 text-slate-800">{strings.generateQuiz}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-8">
            <div className="border-4 border-dashed border-indigo-100 rounded-[2rem] p-12 text-center bg-indigo-50/20 hover:bg-indigo-50 transition-all cursor-pointer relative group">
              <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFiles(Array.from(e.target.files || []))} />
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📤</div>
              <p className="font-black text-indigo-600 text-lg">{strings.uploadFiles}</p>
              <p className="text-xs text-slate-400 mt-2 font-bold">{files.length} ملفات جاهزة</p>
            </div>
            <select value={subId} onChange={e => setSubId(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-600 appearance-none shadow-inner">
              {subjects.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <select value={diff} onChange={e => setDiff(e.target.value as any)} className="p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none text-slate-600">
                <option value={Difficulty.EASY}>{strings.easy}</option>
                <option value={Difficulty.MEDIUM}>{strings.medium}</option>
                <option value={Difficulty.HARD}>{strings.hard}</option>
              </select>
              <select value={type} onChange={e => setType(e.target.value as any)} className="p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none text-slate-600">
                <option value={QuestionType.MCQ}>{strings.mcq}</option>
                <option value={QuestionType.TRUE_FALSE}>{strings.tf}</option>
                <option value={QuestionType.MIX}>{strings.mix}</option>
              </select>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl">
               <span className="px-4 font-black text-slate-400">#</span>
               <input type="number" value={count} onChange={e => setCount(Math.min(200, Number(e.target.value)))} className="flex-1 bg-transparent p-3 font-black text-center text-2xl outline-none" />
            </div>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
              {['original', 'ar', 'en'].map(l => (
                <button key={l} onClick={() => setTargetLang(l)} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${targetLang === l ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>
                  {l === 'original' ? strings.original : l === 'ar' ? strings.toArabic : strings.toEnglish}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={loading} className="w-full mt-12 py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-2xl shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50 transition-all">
          {loading ? 'الذكاء الاصطناعي يقوم بتحليل المادة...' : strings.generateQuiz}
        </button>
      </Card>
    </div>
  );
};

const QuizInterface = ({ strings, lang, setAttempts }: any) => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [cur, setCur] = useState(0);
  const [ans, setAns] = useState<any>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [showRes, setShowRes] = useState(false);
  const [start] = useState(Date.now());

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('mq_quizzes') || '[]');
    const q = saved.find((i: any) => i.id === quizId);
    if (q) setQuiz(q);
  }, [quizId]);

  if (!quiz) return <div className="text-center py-20 font-black text-slate-300">جاري التحميل...</div>;

  const current = quiz.questions[cur];
  const progress = ((cur + 1) / quiz.questions.length) * 100;

  const onAnswer = (opt: string) => {
    if (showExplanation) return;
    setAns({...ans, [current.id]: opt});
    setShowExplanation(true);
  };

  const onNext = () => {
    setShowExplanation(false);
    if (cur < quiz.questions.length - 1) setCur(cur + 1);
    else {
      const score = quiz.questions.reduce((a, q) => a + (ans[q.id] === q.correctAnswer ? 1 : 0), 0);
      const attempt: QuizAttempt = {
        id: Date.now().toString(), quizId: quiz.id, userId: 'user', userName: 'طبيب متميز',
        score, totalQuestions: quiz.questions.length, timeSpent: Math.round((Date.now() - start)/60000), date: Date.now()
      };
      setAttempts((p:any) => [...p, attempt]);
      setShowRes(true);
    }
  };

  if (showRes) {
    const score = quiz.questions.reduce((a, q) => a + (ans[q.id] === q.correctAnswer ? 1 : 0), 0);
    return (
      <div className="max-w-3xl mx-auto animate-in zoom-in duration-500">
        <Card className="text-center p-16 !rounded-[4rem] border-t-8 border-indigo-600">
          <div className="text-8xl mb-6">🏥</div>
          <h2 className="text-4xl font-black mb-10 text-slate-800">{strings.results}</h2>
          <div className="flex justify-center gap-16 mb-12">
            <div><p className="text-6xl font-black text-indigo-600">{score}/{quiz.questions.length}</p><p className="text-slate-400 font-bold uppercase text-xs tracking-widest">{strings.score}</p></div>
            <div><p className="text-6xl font-black text-indigo-600">{Math.round((Date.now()-start)/1000)}ث</p><p className="text-slate-400 font-bold uppercase text-xs tracking-widest">{strings.time}</p></div>
          </div>
          <button onClick={() => navigate('/')} className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all">العودة للرئيسية</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-12 sticky top-24 z-40 bg-slate-50/80 backdrop-blur px-2 py-4">
        <div className="flex justify-between font-black text-xs text-indigo-600 mb-3">
          <span>السؤال {cur+1} من {quiz.questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-4 bg-white rounded-full overflow-hidden shadow-inner border border-slate-100">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 transition-all duration-700" style={{width: `${progress}%`}} />
        </div>
      </div>

      <Card className="p-12 md:p-16 !rounded-[3.5rem] relative">
        <h3 className="text-2xl md:text-3xl font-black mb-14 text-slate-800 leading-snug">{current.text}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(current.options || ['True', 'False']).map((opt, i) => {
             const isSel = ans[current.id] === opt;
             const isCorr = opt === current.correctAnswer;
             let style = "border-slate-100 text-slate-600 hover:bg-slate-50";
             if (showExplanation) {
               if (isCorr) style = "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100";
               else if (isSel) style = "bg-rose-500 border-rose-500 text-white";
               else style = "opacity-40 grayscale";
             } else if (isSel) {
               style = "bg-indigo-600 border-indigo-600 text-white scale-105 shadow-xl";
             }

             return (
               <button 
                 key={i} 
                 onClick={() => onAnswer(opt)} 
                 className={`p-6 rounded-[2rem] border-2 font-black transition-all text-right flex items-center gap-4 ${style}`}
               >
                 <span className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center font-black text-lg ${isSel || (showExplanation && isCorr) ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                   {String.fromCharCode(65+i)}
                 </span>
                 <span className="text-lg">{opt}</span>
               </button>
             );
          })}
        </div>

        {showExplanation && (
          <div className="mt-12 p-8 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 animate-in slide-in-from-top-4 duration-500">
             <h4 className="font-black text-indigo-800 mb-3 flex items-center gap-2">💡 التفسير العلمي:</h4>
             <p className="text-indigo-900/70 font-bold leading-relaxed">{current.explanation}</p>
          </div>
        )}

        <div className="mt-16 flex justify-between items-center">
          <button onClick={() => navigate('/')} className="text-slate-400 font-black hover:text-rose-500 transition-colors">إلغاء الاختبار</button>
          <button 
            onClick={onNext} 
            disabled={!ans[current.id]} 
            className="px-14 py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-2xl active:scale-95 disabled:opacity-20 transition-all flex items-center gap-3"
          >
            {cur === quiz.questions.length - 1 ? strings.finish : strings.next}
            <span className={lang === 'ar' ? 'rotate-180' : ''}>➜</span>
          </button>
        </div>
      </Card>
    </div>
  );
};

/** --- المخططات والإحصائيات --- */

const StatsView = ({ attempts }: any) => {
  const data = useMemo(() => attempts.slice(-10).map((a:any, i:number) => ({ 
    name: `T${i+1}`, 
    score: Math.round((a.score/a.totalQuestions)*100) 
  })), [attempts]);

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700">
      <Card className="p-12 !rounded-[3rem]">
        <h2 className="text-3xl font-black mb-10 text-slate-800">منحنى التطور الأكاديمي</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 'bold'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 'bold'}} unit="%" />
              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px'}} />
              <Bar dataKey="score" radius={[12, 12, 0, 0]}>
                {data.map((e:any, i:number) => (
                  <Cell key={i} fill={e.score >= 80 ? '#10b981' : e.score >= 50 ? '#6366f1' : '#f43f5e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-8">
           <h3 className="text-xl font-black mb-6">أحدث الاختبارات</h3>
           <div className="space-y-4">
             {attempts.slice(-5).reverse().map((a:any) => (
               <div key={a.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-500">{new Date(a.date).toLocaleDateString()}</span>
                  <span className="font-black text-indigo-600 text-lg">{a.score}/{a.totalQuestions}</span>
               </div>
             ))}
           </div>
        </Card>
        <Card className="p-8 bg-indigo-600 text-white">
           <h3 className="text-xl font-black mb-6">نصيحة الطبيب الذكي</h3>
           <p className="font-bold opacity-90 leading-relaxed italic text-lg">
             "بناءً على نتائجك الأخيرة، نوصيك بالتركيز أكثر على الحالات الإكلينيكية المرتبطة بالفيزيولوجيا المرضية لزيادة دقتك في التشخيص التفريقي."
           </p>
        </Card>
      </div>
    </div>
  );
};

const Leaderboard = ({ attempts }: any) => {
  const board = useMemo(() => {
    const mocks = [
      { id: '1', userName: 'د. سارة المنصور', score: 19, totalQuestions: 20, date: Date.now() },
      { id: '2', userName: 'د. خالد اليوسف', score: 17, totalQuestions: 20, date: Date.now() },
    ];
    const all = [...attempts, ...mocks].sort((a,b) => (b.score/b.totalQuestions)-(a.score/a.totalQuestions)).slice(0, 10);
    return all;
  }, [attempts]);

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-[4rem] shadow-2xl overflow-hidden border border-slate-50 animate-in slide-in-from-bottom-10 duration-700">
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-14 text-white text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-4xl font-black">نخبة الأطباء</h2>
        <p className="opacity-70 font-bold mt-2 uppercase tracking-widest text-xs">أفضل النتائج لهذا الأسبوع</p>
      </div>
      <div className="p-10 space-y-4 bg-slate-50/50">
        {board.map((item, idx) => (
          <div key={item.id} className={`flex items-center gap-6 p-6 rounded-[2.5rem] transition-all ${idx === 0 ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'bg-white text-slate-800'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${idx === 0 ? 'bg-white/20' : idx === 1 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{idx+1}</div>
            <div className="flex-1 font-black text-lg">{item.userName}</div>
            <div className="text-right">
              <p className="text-2xl font-black">{Math.round((item.score/item.totalQuestions)*100)}%</p>
              <p className="text-[10px] font-bold opacity-50">{item.score}/{item.totalQuestions}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** --- التطبيق الرئيسي --- */

const App = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const s = localStorage.getItem('mq_subjects');
      return s ? JSON.parse(s) : [
        { id: '1', name: 'Internal Medicine', chapters: [] },
        { id: '2', name: 'Cardiology', chapters: [] }
      ];
    } catch { return []; }
  });
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    try {
      const a = localStorage.getItem('mq_attempts');
      return a ? JSON.parse(a) : [];
    } catch { return []; }
  });

  const strings = TRANSLATIONS[lang];

  useEffect(() => localStorage.setItem('mq_subjects', JSON.stringify(subjects)), [subjects]);
  useEffect(() => localStorage.setItem('mq_attempts', JSON.stringify(attempts)), [attempts]);

  return (
    <Router>
      <div className={`min-h-screen bg-slate-50 pb-20 overflow-x-hidden ${lang === 'ar' ? 'rtl' : ''}`}>
        <Navbar lang={lang} setLang={setLang} strings={strings} />
        <main className="container mx-auto px-6 py-12 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard strings={strings} subjects={subjects} setSubjects={setSubjects} attempts={attempts} lang={lang} />} />
            <Route path="/create" element={<CreateQuiz strings={strings} subjects={subjects} lang={lang} />} />
            <Route path="/quiz/:quizId" element={<QuizInterface strings={strings} lang={lang} setAttempts={setAttempts} />} />
            <Route path="/stats" element={<StatsView attempts={attempts} />} />
            <Route path="/leaderboard" element={<Leaderboard attempts={attempts} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;

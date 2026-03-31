import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { ArrowRight, Globe, Lock, Users, Shield, Zap, Search } from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const staggerChildren = {
  visible: { transition: { staggerChildren: 0.1 } }
};

export function Home() {
  return (
    <div className="flex flex-col min-h-[80vh] w-full items-center">

      {/* Hero Section */}
      <section className="w-full py-20 lg:py-32 flex flex-col items-center text-center px-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl rounded-full dark:from-blue-600/20 pointer-events-none" />

        <motion.div
          initial="hidden" animate="visible" variants={staggerChildren}
          className="max-w-4xl mx-auto z-10"
        >
          <motion.div variants={fadeIn} className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-bold border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
              <Zap className="w-4 h-4" /> Introducing DMR
            </span>
          </motion.div>

          <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-8 leading-tight">
            Manage Your Documents <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Smarter & Faster.</span>
          </motion.h1>

          <motion.p variants={fadeIn} className="text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Securely store, organize, and share documents across Public, Private, and Organization spaces with enterprise-level access controls and AI-powered tagging.
          </motion.p>

          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 rounded-2xl shadow-xl shadow-blue-500/20 group">
                Get Started for Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/public">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto text-lg px-8 py-6 rounded-2xl group">
                <Search className="mr-2 w-5 h-5 text-blue-500" />
                Browse Public Documents
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="w-full max-w-7xl mx-auto py-20 px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Three Spaces. Total Control.</h2>
          <p className="text-gray-600 dark:text-gray-400">Designed to handle every type of document workflow.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Globe, title: "Public Space", desc: "Share open-access institutional documents, research papers, and assignments globally with auto AI tagging.", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            { icon: Lock, title: "Private Vault", desc: "Your secure personal vault. Highly encrypted space for your sensitive data, with granular sharing permissions.", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
            { icon: Users, title: "Organization", desc: "Collaborate seamlessly with your team. Dedicated storage quotas and role-based access control (Admin, Member, Viewer).", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10" }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 group"
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`w-7 h-7 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="w-full bg-gray-900 dark:bg-black text-white py-24 px-4 mt-12 rounded-[3rem] mx-4 max-w-[96%] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-16">Enterprise-Grade Security</h2>
          <div className="grid sm:grid-cols-2 gap-12 text-left">
            <div className="flex gap-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0"><Shield className="w-6 h-6" /></div>
              <div>
                <h4 className="text-xl font-bold mb-2">Automated S3 Backups</h4>
                <p className="text-gray-400">All documents are securely streamed directly to AWS S3 buckets with high durability and instant retrieval.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0"><Lock className="w-6 h-6" /></div>
              <div>
                <h4 className="text-xl font-bold mb-2">Granular Permissions</h4>
                <p className="text-gray-400">Share files instantly by email. Assign Viewer or Editor roles precisely to individuals securely.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Bus, MapPinned, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import PasswordField from "../components/PasswordField.jsx";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const { register, handleSubmit, formState, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "transportadmin@bit.edu.in", password: "SmartFleet@123" }
  });

  async function onSubmit(values) {
    try {
      const result = await api.post("/auth/login", values);
      setSession(result.data);
      navigate(result.data.user.role === "DRIVER" ? "/driver" : "/");
    } catch (error) {
      setError("root", { message: error.message });
    }
  }

  return (
    <main className="auth-background grid min-h-screen place-items-center p-4 sm:p-8">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl shadow-slate-950/30 lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative hidden min-h-[620px] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-primary p-10 text-white lg:block">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-300/20 blur-2xl" />
          <div className="absolute -bottom-24 left-14 h-64 w-64 rounded-full bg-blue-400/20 blur-2xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Bus className="h-6 w-6 text-teal-200" /></div><div><p className="text-lg font-bold">BIT SmartFleet</p><p className="text-xs text-slate-400">Centralized transport operations</p></div></div>
            <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-200">Fleet management, simplified</p><h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">Every journey, <br />under control.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">A connected workspace for trip requests, allocation, driver operations, and real-time transport visibility.</p></div>
            <div className="grid gap-3"><Feature icon={MapPinned} text="Live trip and location updates" /><Feature icon={ShieldCheck} text="Role-based operational controls" /></div>
          </div>
        </div>
        <div className="flex min-w-0 items-center p-6 sm:p-10">
          <div className="min-w-0 w-full max-w-md">
            <div className="mb-8 lg:hidden"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white"><Bus className="h-6 w-6" /></div><p className="page-kicker">BIT SmartFleet</p></div>
            <p className="page-kicker">Welcome back</p>
            <h1 className="max-w-full break-words text-3xl font-bold leading-tight tracking-tight text-slate-950">Sign in to your workspace</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use your institutional account to continue.</p>
            <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <label className="form-control"><span className="mb-2 text-sm font-semibold text-slate-700">Email address</span><input className="app-input" placeholder="name@bit.edu.in" type="email" {...register("email")} />{formState.errors.email ? <span className="mt-1 text-xs text-error">Enter a valid email address.</span> : null}</label>
              <label className="form-control"><span className="mb-2 text-sm font-semibold text-slate-700">Password</span><PasswordField placeholder="Enter your password" {...register("password")} />{formState.errors.password ? <span className="mt-1 text-xs text-error">Password is required.</span> : null}</label>
              {formState.errors.root ? <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{formState.errors.root.message}</p> : null}
              <button className="btn btn-primary h-12 w-full rounded-xl text-sm" disabled={formState.isSubmitting}>Login <ArrowRight className="h-4 w-4" /></button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">New here? <Link className="font-semibold text-primary hover:underline" to="/register">Create an account</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, text }) {
  return <div className="flex items-center gap-3 text-sm text-slate-200"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Icon className="h-4 w-4 text-teal-200" /></span>{text}</div>;
}

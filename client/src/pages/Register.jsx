import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Bus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../lib/api.js";
import PasswordField from "../components/PasswordField.jsx";
import { useAuthStore } from "../store/authStore.js";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string()
});

export default function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const { register, handleSubmit, formState, setError, watch } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: "FACULTY_STAFF" }
  });
  const role = watch("role");

  async function onSubmit(values) {
    try {
      const result = await api.post("/auth/register", values);
      setSession(result.data);
      navigate("/");
    } catch (error) {
      setError("root", { message: error.message });
    }
  }

  return (
    <main className="auth-background grid min-h-screen min-h-dvh place-items-center p-4 sm:p-8">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl shadow-slate-950/30 lg:grid-cols-[.9fr_1.1fr]">
        <div className="relative hidden min-h-[650px] overflow-hidden bg-gradient-to-br from-primary via-teal-700 to-slate-950 p-10 text-white lg:block">
          <div className="absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-teal-200/20 blur-2xl" />
          <div className="relative flex h-full flex-col justify-between"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Bus className="h-6 w-6 text-teal-100" /></div><div><p className="text-lg font-bold">BIT SmartFleet</p><p className="text-xs text-teal-100/70">Centralized transport operations</p></div></div><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-100">Join the platform</p><h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">Start moving smarter.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-teal-50/80">Create a faculty or driver account to participate in BIT’s connected transport workflow.</p></div><p className="text-sm text-teal-100/70">Built for safer, better organized institutional travel.</p></div>
        </div>
        <div className="flex min-w-0 items-center p-6 sm:p-10"><div className="min-w-0 w-full max-w-md"><div className="mb-7 lg:hidden"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white"><Bus className="h-6 w-6" /></div></div><p className="page-kicker">New account</p><h1 className="max-w-full break-words text-3xl font-bold leading-tight tracking-tight text-slate-950">Create your workspace access</h1><p className="mt-2 text-sm leading-6 text-slate-500">It only takes a moment to get started.</p>
        <form className="mt-8 grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="form-control"><span className="mb-2 text-sm font-semibold text-slate-700">Full name</span><input className="app-input" placeholder="Your name" {...register("name")} /></label>
          <label className="form-control"><span className="mb-2 text-sm font-semibold text-slate-700">Institutional email</span><input className="app-input" placeholder="name@bit.edu.in" type="email" {...register("email")} /></label>
          <label className="form-control"><span className="mb-2 text-sm font-semibold text-slate-700">Password</span><PasswordField placeholder="At least 8 characters" {...register("password")} /></label>
          <label className="form-control"><span className="mb-2 text-sm font-semibold text-slate-700">I am joining as</span><select className="app-select" {...register("role")}><option>FACULTY_STAFF</option><option>DRIVER</option></select></label>
          {role === "DRIVER" ? <label className="form-control"><span className="mb-2 text-sm font-semibold text-slate-700">Driving licence number</span><input className="app-input" placeholder="Enter licence number" {...register("licenseNumber")} /></label> : null}
          {formState.errors.root ? <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{formState.errors.root.message}</p> : null}
          <button className="btn btn-primary mt-2 h-12 rounded-xl text-sm" disabled={formState.isSubmitting}>Create account <ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link className="font-semibold text-primary hover:underline" to="/login">Sign in</Link></p></div></div>
      </section>
    </main>
  );
}

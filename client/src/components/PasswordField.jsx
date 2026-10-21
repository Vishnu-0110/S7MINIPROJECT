import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

const PasswordField = forwardRef(function PasswordField({ className = "app-input", ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} ref={ref} className={`${className} pr-11`} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
});

export default PasswordField;

import { zodResolver } from "@hookform/resolvers/zod";
import { Bot, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../lib/api.js";
import { indiaDateInputValue, indiaDateTimeToIso } from "../lib/dateTime.js";

const schema = z.object({
  tripType: z.string().min(1),
  destination: z.string().min(2),
  passengerCount: z.coerce.number().positive(),
  date: z.string().min(1),
  departureTime: z.string().min(1),
  priority: z.string()
});

const tripTypes = ["Local Official Visit", "Industrial Visit", "Field Trip", "Conference", "Placement", "Event", "Academic Visit", "Outstation Trip", "Other Official Trip"];

export default function RequestForm() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");
  const { register, handleSubmit, formState, setValue, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      tripType: "Industrial Visit",
      priority: "Normal"
    }
  });

  async function parsePrompt() {
    try {
      setAiError("");
      const result = await api.post("/ai/parse-trip", { prompt });
      setAiResult(result.data);
    } catch (error) {
      setAiError(error.message);
    }
  }

  function applyAi() {
    if (!aiResult) return;
    if (aiResult.tripType) setValue("tripType", aiResult.tripType);
    if (aiResult.destination) setValue("destination", aiResult.destination);
    if (aiResult.passengerCount) setValue("passengerCount", aiResult.passengerCount);
    if (aiResult.timeText) {
      const time = aiResult.timeText.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
      if (time) {
        let hours = Number(time[1]) % 12;
        if (time[3].toUpperCase() === "PM") hours += 12;
        setValue("departureTime", `${String(hours).padStart(2, "0")}:${time[2] || "00"}`);
      }
    }
    if (aiResult.dateText?.toLowerCase().includes("next monday")) {
      const date = new Date();
      const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
      date.setDate(date.getDate() + daysUntilMonday);
      setValue("date", indiaDateInputValue(date));
    }
  }

  async function onSubmit(values) {
    try {
      const departureIso = indiaDateTimeToIso(values.date, values.departureTime);
      const departure = new Date(departureIso);
      if (departure <= new Date()) {
        setError("root", { message: "Departure time must be in the future." });
        return;
      }
      const returning = new Date(departure.getTime() + 8 * 60 * 60 * 1000);
      const payload = {
        ...values,
        date: `${values.date}T00:00:00+05:30`,
        departureTime: departureIso,
        returnTime: returning.toISOString(),
        waypoints: [],
        passengers: []
      };
      await api.post("/requests", payload);
      navigate("/requests");
    } catch (error) {
      setError("root", { message: error.message });
    }
  }

  return (
    <div className="responsive-panel-grid">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Vehicle Request</h2>
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <select className="select select-bordered" aria-label="Trip type" {...register("tripType")}>
            {tripTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
          <input className="input input-bordered" aria-label="Destination" placeholder="Destination" {...register("destination")} />
          <input className="input input-bordered" aria-label="Passenger count" placeholder="Passenger count" type="number" {...register("passengerCount")} />
          <select className="select select-bordered" aria-label="Request priority" {...register("priority")}>
            <option>Normal</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
          <input className="input input-bordered" aria-label="Trip date" type="date" {...register("date")} />
          <label className="form-control"><span className="label-text mb-1">Start time</span><input className="input input-bordered" type="time" {...register("departureTime")} /></label>
          {formState.errors.root ? <p className="text-sm text-error md:col-span-2">{formState.errors.root.message}</p> : null}
          <button className="btn btn-primary md:col-span-2" disabled={formState.isSubmitting}>
            <Send className="h-4 w-4" />
            Submit request
          </button>
        </form>
      </section>
      <aside className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">AI Trip Assistant</h2>
        </div>
        <textarea
          className="textarea textarea-bordered mt-4 min-h-28 w-full"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="I need a vehicle for 25 students to visit an industry in Coimbatore next Monday at 8 AM."
        />
        <button className="btn btn-secondary mt-3 w-full" onClick={parsePrompt} type="button">Parse trip</button>
        {aiError ? <p className="mt-3 text-sm text-error">{aiError}</p> : null}
        {aiResult ? (
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
            <p>Trip Type: {aiResult.tripType}</p>
            <p>Passengers: {aiResult.passengerCount || "Not found"}</p>
            <p>Destination: {aiResult.destination || "Not found"}</p>
            <p>Date: {aiResult.dateText || "Edit manually"}</p>
            <p>Time: {aiResult.timeText || "Edit manually"}</p>
            <button className="btn btn-primary btn-sm mt-3" onClick={applyAi} type="button">Use details</button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

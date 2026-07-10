"use client";

const EXAMPLES = ["Tesla", "Infosys", "Nvidia", "RELIANCE"];

export default function CompanyForm({ value, onChange, onSubmit, running }) {
  return (
    <>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running && value.trim()) onSubmit();
        }}
      >
        <input
          type="text"
          placeholder="Company name or ticker, e.g. Tesla or TSLA"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={running}
        />
        <button type="submit" disabled={running || !value.trim()}>
          {running ? "Researching…" : "Run research"}
        </button>
      </form>
      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => onChange(ex)} disabled={running}>
            {ex}
          </button>
        ))}
      </div>
    </>
  );
}

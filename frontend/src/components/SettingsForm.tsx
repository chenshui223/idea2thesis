type ThesisCoverFormValue = {
  school: string;
  department: string;
  major: string;
  studentName: string;
  studentId: string;
  advisor: string;
};

type SettingsFormProps = {
  apiKey: string;
  baseUrl: string;
  model: string;
  thesisCover: ThesisCoverFormValue;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onThesisCoverChange: (patch: Partial<ThesisCoverFormValue>) => void;
  onResetThesisCover: () => void;
};

export function SettingsForm(props: SettingsFormProps) {
  return (
    <section>
      <h2>Model Settings</h2>
      <label>
        API Key
        <input
          aria-label="API Key"
          type="password"
          value={props.apiKey}
          onChange={(event) => props.onApiKeyChange(event.target.value)}
        />
      </label>
      <label>
        Base URL
        <input
          aria-label="Base URL"
          value={props.baseUrl}
          onChange={(event) => props.onBaseUrlChange(event.target.value)}
        />
      </label>
      <label>
        Model
        <input
          aria-label="Model"
          value={props.model}
          onChange={(event) => props.onModelChange(event.target.value)}
        />
      </label>
      <section aria-labelledby="thesis-cover-heading">
        <h3 id="thesis-cover-heading">Thesis Cover</h3>
        <button type="button" onClick={props.onResetThesisCover}>
          Reset Thesis Cover
        </button>
        <label>
          School
          <input
            aria-label="School"
            value={props.thesisCover.school}
            onChange={(event) =>
              props.onThesisCoverChange({ school: event.target.value })
            }
          />
        </label>
        <label>
          Department
          <input
            aria-label="Department"
            value={props.thesisCover.department}
            onChange={(event) =>
              props.onThesisCoverChange({ department: event.target.value })
            }
          />
        </label>
        <label>
          Major
          <input
            aria-label="Major"
            value={props.thesisCover.major}
            onChange={(event) =>
              props.onThesisCoverChange({ major: event.target.value })
            }
          />
        </label>
        <label>
          Student Name
          <input
            aria-label="Student Name"
            value={props.thesisCover.studentName}
            onChange={(event) =>
              props.onThesisCoverChange({ studentName: event.target.value })
            }
          />
        </label>
        <label>
          Student ID
          <input
            aria-label="Student ID"
            value={props.thesisCover.studentId}
            onChange={(event) =>
              props.onThesisCoverChange({ studentId: event.target.value })
            }
          />
        </label>
        <label>
          Advisor
          <input
            aria-label="Advisor"
            value={props.thesisCover.advisor}
            onChange={(event) =>
              props.onThesisCoverChange({ advisor: event.target.value })
            }
          />
        </label>
      </section>
    </section>
  );
}

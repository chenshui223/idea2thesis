type SettingsFormProps = {
  apiKey: string;
  baseUrl: string;
  model: string;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
};

export function SettingsForm(props: SettingsFormProps) {
  return (
    <section>
      <h2>Model Settings</h2>
      <label>
        API Key
        <input
          aria-label="API Key"
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
    </section>
  );
}

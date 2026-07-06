import { useSettingsStore } from '../settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      highContrastMode: false,
      fontScale: 1.0,
      reducedMotion: false,
      language: null,
    });
  });

  it('has accessible-by-default initial state', () => {
    const s = useSettingsStore.getState();
    expect(s.highContrastMode).toBe(false);
    expect(s.fontScale).toBe(1.0);
    expect(s.language).toBeNull(); // follow device locale until user chooses
  });

  it('clamps fontScale to the supported 1.0–2.0 range', () => {
    const { setFontScale } = useSettingsStore.getState();

    setFontScale(1.5);
    expect(useSettingsStore.getState().fontScale).toBe(1.5);

    setFontScale(5);
    expect(useSettingsStore.getState().fontScale).toBe(2.0);

    setFontScale(0.2);
    expect(useSettingsStore.getState().fontScale).toBe(1.0);
  });

  it('toggles high contrast and reduced motion', () => {
    const { setHighContrast, setReducedMotion } = useSettingsStore.getState();
    setHighContrast(true);
    setReducedMotion(true);
    expect(useSettingsStore.getState().highContrastMode).toBe(true);
    expect(useSettingsStore.getState().reducedMotion).toBe(true);
  });

  it('stores an explicit language choice and can clear it back to device-follow', () => {
    const { setLanguage } = useSettingsStore.getState();
    setLanguage('he');
    expect(useSettingsStore.getState().language).toBe('he');
    setLanguage(null);
    expect(useSettingsStore.getState().language).toBeNull();
  });
});

"""
TR8 Streamlit Web-UI — Pattern & Kit Generator für die Roland TR-8S
"""

import streamlit as st
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.models import (
    Kit, Pattern, Variation, StepPattern, InstrumentType,
    INSTRUMENT_ORDER, DEFAULT_NOTES,
)
from core.t8k_writer import T8KWriter
from core.t8p_writer import T8PWriter


# === Config ===
st.set_page_config(
    page_title="TR8 — TR-8S Pattern Generator",
    page_icon="🥁",
    layout="wide",
)

# === State Init ===
if "kit" not in st.session_state:
    st.session_state.kit = Kit(name="My Kit")
if "pattern" not in st.session_state:
    st.session_state.pattern = Pattern(name="My Pattern", tempo=120.0)
if "current_variation" not in st.session_state:
    st.session_state.current_variation = 0
if "current_instrument" not in st.session_state:
    st.session_state.current_instrument = InstrumentType.BD


# === Sidebar ===
with st.sidebar:
    st.title("🥁 TR8")
    st.caption("TR-8S Pattern & Kit Generator")

    page = st.radio(
        "Navigation",
        ["Pattern Editor", "Kit Editor", "Export"],
        index=0,
    )

    st.divider()
    st.markdown("""
    **Info:** Experimenteller Pattern-Generator für die Roland TR-8S.
    Generiert .t8p und .t8k Dateien für den Import via SD-Karte.
    """)


# === Pattern Editor ===
if page == "Pattern Editor":
    st.header("🎹 Pattern Editor")

    pattern = st.session_state.pattern

    # Pattern-Parameter
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        pattern.name = st.text_input("Pattern Name", pattern.name)
    with col2:
        pattern.tempo = st.slider("Tempo (BPM)", 20.0, 300.0, pattern.tempo, 0.1)
    with col3:
        pattern.swing = st.slider("Swing", 0, 127, pattern.swing)
    with col4:
        pattern.scale = st.selectbox("Scale", [1, 2], index=pattern.scale - 1,
                                      format_func=lambda x: "1/8" if x == 1 else "1/16")

    # Variation-Auswahl
    st.divider()
    var_cols = st.columns(8)
    for i, col in enumerate(var_cols):
        with col:
            letter = chr(65 + i)
            if st.button(letter, key=f"var_{i}",
                        use_container_width=True,
                        type="primary" if i == st.session_state.current_variation else "secondary"):
                st.session_state.current_variation = i

    variation = pattern.variations[st.session_state.current_variation]

    # Last Step
    variation.last_step = st.slider(
        "Last Step", 0, 15, variation.last_step,
        help="Letzter aktiver Step (0=1 Step, 15=16 Steps)"
    )

    # Instrument-Auswahl
    st.divider()
    inst_names = [f"{inst.value}" for inst in INSTRUMENT_ORDER]
    selected_inst_idx = st.radio(
        "Instrument",
        range(len(INSTRUMENT_ORDER)),
        format_func=lambda i: inst_names[i],
        horizontal=True,
        index=INSTRUMENT_ORDER.index(st.session_state.current_instrument),
    )
    st.session_state.current_instrument = INSTRUMENT_ORDER[selected_inst_idx]
    current_inst = st.session_state.current_instrument

    # Step-Grid (16 Pads)
    st.divider()
    st.subheader(f"Steps — {current_inst.value}")

    # 4 Reihen à 4 Steps (wie auf der TR-8S)
    for row in range(4):
        cols = st.columns(4)
        for col_idx, col in enumerate(cols):
            step_idx = row * 4 + col_idx
            with col:
                step_active = variation.instruments[current_inst].steps[step_idx]
                accent_active = variation.instruments[current_inst].accents[step_idx]
                flam_active = variation.instruments[current_inst].flams[step_idx]

                # Step-Button
                label = f"**{step_idx + 1}**"
                if accent_active:
                    label += " 💥"
                if flam_active:
                    label += " 🔥"

                if st.button(
                    label,
                    key=f"step_{step_idx}",
                    use_container_width=True,
                    type="primary" if step_active else "secondary",
                ):
                    variation.instruments[current_inst].toggle_step(step_idx)
                    st.rerun()

                # Sub-Kontrollen
                a, f = st.columns(2)
                with a:
                    if st.checkbox("ACC", key=f"acc_{step_idx}",
                                   value=accent_active):
                        variation.instruments[current_inst].accents[step_idx] = True
                    else:
                        variation.instruments[current_inst].accents[step_idx] = False
                with f:
                    if st.checkbox("FLM", key=f"flam_{step_idx}",
                                   value=flam_active):
                        variation.instruments[current_inst].flams[step_idx] = True
                    else:
                        variation.instruments[current_inst].flams[step_idx] = False

    # Visual Pattern Overview
    st.divider()
    st.subheader("Pattern Übersicht")

    # Grid-Darstellung aller Instrumente
    header = "Inst | " + " ".join([f"{i+1:>2}" for i in range(16)]) + " |"
    st.text(header)
    st.text("-" * len(header))

    for inst in INSTRUMENT_ORDER:
        steps = variation.instruments[inst].steps
        row_str = f"{inst.value:4} | "
        for i in range(16):
            if i > variation.last_step:
                row_str += " · "
            elif steps[i]:
                row_str += " X "
            else:
                row_str += " · "
        row_str += " |"
        st.text(row_str)


# === Kit Editor ===
elif page == "Kit Editor":
    st.header("🎛️ Kit Editor")

    kit = st.session_state.kit

    # Kit-Parameter
    kit.name = st.text_input("Kit Name", kit.name)
    kit.slot = st.slider("Kit Slot", 0, 127, kit.slot)

    st.divider()

    # Instrument-Parameter
    for inst in INSTRUMENT_ORDER:
        with st.expander(f"{inst.value} — {DEFAULT_NOTES[inst]}", expanded=False):
            params = kit.instruments[inst]

            col1, col2, col3, col4 = st.columns(4)
            with col1:
                params.tune = st.slider(
                    "Tune", 0, 127, params.tune,
                    key=f"tune_{inst.value}"
                )
            with col2:
                params.decay = st.slider(
                    "Decay", 0, 127, params.decay,
                    key=f"decay_{inst.value}"
                )
            with col3:
                params.level = st.slider(
                    "Level", 0, 127, params.level,
                    key=f"level_{inst.value}"
                )
            with col4:
                params.ctrl = st.slider(
                    "Ctrl", 0, 127, params.ctrl,
                    key=f"ctrl_{inst.value}"
                )

            params.use_alt = st.checkbox(
                "Use ALT Sound",
                value=params.use_alt,
                key=f"alt_{inst.value}"
            )

            # Reverb/Delay Send
            kit.reverb_send[inst] = st.slider(
                "Reverb Send", 0, 127, kit.reverb_send[inst],
                key=f"rev_{inst.value}"
            )
            kit.delay_send[inst] = st.slider(
                "Delay Send", 0, 127, kit.delay_send[inst],
                key=f"del_{inst.value}"
            )

    # Master FX
    st.divider()
    st.subheader("Master Effects")

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Reverb**")
        kit.reverb_type = st.selectbox("Type", range(8), index=kit.reverb_type,
                                        key="rev_type")
        kit.reverb_time = st.slider("Time", 0, 127, kit.reverb_time, key="rev_time")
        kit.reverb_level = st.slider("Level", 0, 127, kit.reverb_level, key="rev_level")
    with col2:
        st.markdown("**Delay**")
        kit.delay_type = st.selectbox("Type", range(8), index=kit.delay_type,
                                       key="del_type")
        kit.delay_time = st.slider("Time", 0, 127, kit.delay_time, key="del_time")
        kit.delay_level = st.slider("Level", 0, 127, kit.delay_level, key="del_level")


# === Export ===
elif page == "Export":
    st.header("📤 Export")

    pattern = st.session_state.pattern
    kit = st.session_state.kit

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Pattern (.t8p)")
        st.json({
            "name": pattern.name,
            "tempo": pattern.tempo,
            "swing": pattern.swing,
            "scale": pattern.scale,
            "variations": pattern.active_variations,
            "kit": pattern.kit_slot,
        })

        if st.button("📥 Pattern Exportieren (.t8p)", type="primary"):
            writer = T8PWriter(pattern)
            output_path = f"output/{pattern.name.replace(' ', '_')}.t8p"
            writer.write(output_path)
            st.success(f"✅ Pattern gespeichert: `{output_path}`")

            # TXT anzeigen
            txt_path = Path(output_path).with_suffix(".txt")
            if txt_path.exists():
                st.text(txt_path.read_text())

    with col2:
        st.subheader("Kit (.t8k)")
        st.json({
            "name": kit.name,
            "slot": kit.slot,
            "instruments": {
                inst.value: {
                    "tune": kit.instruments[inst].tune,
                    "decay": kit.instruments[inst].decay,
                    "level": kit.instruments[inst].level,
                }
                for inst in INSTRUMENT_ORDER
            },
        })

        if st.button("📥 Kit Exportieren (.t8k)", type="primary"):
            writer = T8KWriter(kit)
            output_path = f"output/{kit.name.replace(' ', '_')}.t8k"
            writer.write(output_path)
            st.success(f"✅ Kit gespeichert: `{output_path}`")

            txt_path = Path(output_path).with_suffix(".txt")
            if txt_path.exists():
                st.text(txt_path.read_text())

    st.divider()
    st.subheader("📁 SD-Karten Transfer")
    st.markdown("""
    **So bringst du die Dateien auf die TR-8S:**

    1. SD-Karte in den Computer stecken
    2. `.t8p` Datei nach `ROLAND/TR-8S/EXPORT/PATTERN/` kopieren
    3. `.t8k` Datei nach `ROLAND/TR-8S/EXPORT/KIT/` kopieren
    4. SD-Karte in die TR-8S stecken
    5. **UTILITY → Import → Pattern/Kit** wählen
    6. Fertig! 🎉

    **Wichtig:** Samples müssen in `ROLAND/TR-8S/SAMPLE/` liegen!
    """)


# === Footer ===
st.divider()
st.caption("⚠️ Experimentell — Generierte Dateien sind basierend auf Reverse Engineering. "
           "Validierung mit echter TR-8S Hardware erforderlich.")

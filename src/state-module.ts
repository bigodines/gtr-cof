namespace state {

    export interface State {
        index: number;
        naturalIndex: number;
        chordIndex: number;
        chordIntervals: number[];
        toggledIndexes: number;
        scaleFamilyIndex: number;
        modeIndex: number;
        midiToggledIndexes: number;
        isLeftHanded: boolean;
        isNutFlipped: boolean;
        fretboardLabelType: events.FretboardLabelType;
        circleIsCNoon: boolean;
        tuningIndex: number;
    }

    // default initial state
    export const defaultState: State = {
        index: 3, // C
        naturalIndex: 3, // C
        chordIndex: -1, // no chord
        chordIntervals: [0, 2, 4], // standard triad
        toggledIndexes: 0, // index bitflag
        scaleFamilyIndex: 0, // diatornic
        modeIndex: 0, // major
        midiToggledIndexes: 0,
        isLeftHanded: false,
        isNutFlipped: false,
        fretboardLabelType: events.FretboardLabelType.NoteName,
        circleIsCNoon: true,
        tuningIndex: 0,
    }

    let current: State = {
        index: defaultState.index,
        naturalIndex: defaultState.naturalIndex,
        chordIndex: defaultState.chordIndex,
        chordIntervals: defaultState.chordIntervals,
        toggledIndexes: defaultState.toggledIndexes,
        scaleFamilyIndex: defaultState.scaleFamilyIndex,
        modeIndex: defaultState.modeIndex,
        midiToggledIndexes: defaultState.midiToggledIndexes,
        isLeftHanded: defaultState.isLeftHanded,
        isNutFlipped: defaultState.isNutFlipped,
        fretboardLabelType: defaultState.fretboardLabelType,
        circleIsCNoon: defaultState.circleIsCNoon,
        tuningIndex: defaultState.tuningIndex,
    };

    export function init() {

        try{
            let cookieState = cookies.readCookie2();
            if(cookieState !== null) {
                current = cookieState;
            }
        }
        catch(e) {
            // ignore the invalid cookie:
        }

        // update current state based on querystring.
        current = permalink.getState(current);        

        // lets remember this while we reset everything.
        let tempChordIndex = current.chordIndex;
        let tempToggledIndexes = current.toggledIndexes;

        let scaleFamily = music.scaleFamily.find(x => x.index == current.scaleFamilyIndex);
        if(!scaleFamily) {
            throw "scaleFamily is " + scaleFamily + ", current.scaleFamilyIndex = " + current.scaleFamilyIndex;
        }
        let mode = scaleFamily.modes.find(x => x.index == current.modeIndex);
        if(!mode) {
            throw "mode is " + mode + "current.modeIndex" + current.modeIndex;
        }

        // publish scale and mode
        events.scaleFamilyChange.publish({ scaleFamily: scaleFamily });
        events.modeChange.publish({ mode: mode });
        events.chordIntervalChange.publish( { chordIntervals: current.chordIntervals });

        // subscriptions
        events.tonicChange.subscribe(tonicChanged);
        events.modeChange.subscribe(modeChanged);
        events.chordChange.subscribe(chordChanged);
        events.toggle.subscribe(toggle);
        events.chordIntervalChange.subscribe(chordIntervalChanged);
        events.scaleFamilyChange.subscribe(scaleFamilyChanged);
        events.midiNote.subscribe(midiNote);

        // publish tonic and chord
        events.tonicChange.publish({ noteSpec: music.createNoteSpec(current.naturalIndex, current.index) });
        events.chordChange.publish({ chordIndex: tempChordIndex });
        // restore toggles
        current.toggledIndexes = tempToggledIndexes;
        updateScale();

        // publish settings
        events.leftHandedChange.publish({ isLeftHanded: current.isLeftHanded });
        events.flipNutChange.publish( { isNutFlipped: current.isNutFlipped });
        events.fretboardLabelChange.publish({ labelType: current.fretboardLabelType })
        events.setCToNoon.publish({ isC: current.circleIsCNoon });
        events.tuningChange.publish({ index: current.tuningIndex });

        // subscribe to settings changes
        events.leftHandedChange.subscribe(leftHandedChange);
        events.flipNutChange.subscribe(flipNutChange);
        events.fretboardLabelChange.subscribe(fretboardLabelChange)
        events.setCToNoon.subscribe(setCToNoon);
        events.tuningChange.subscribe(tuningChange);
    }

    function tonicChanged(tonicChangedEvent: events.TonicChangedEvent): void {
        current.index = tonicChangedEvent.noteSpec.index;
        current.naturalIndex = tonicChangedEvent.noteSpec.natural.index;
        current.chordIndex = -1;
        updateScale();
    }

    function modeChanged(modeChangedEvent: events.ModeChangedEvent): void {
        current.modeIndex = modeChangedEvent.mode.index;
        current.chordIndex = -1;
        updateScale();
    }

    function chordChanged(chordChangedEvent: events.ChordChangeEvent): void {
        if(chordChangedEvent.chordIndex === current.chordIndex) {
            current.chordIndex = -1
        }
        else {
            current.chordIndex = chordChangedEvent.chordIndex;
        }
        current.toggledIndexes = 0;
        updateScale();
    }

    function toggle(toggleEvent: events.ToggleEvent): void {
        current.toggledIndexes = current.toggledIndexes ^ 2**toggleEvent.index;
        updateScale();
    }

    function chordIntervalChanged(chordIntervalChangedEvent: events.ChordIntervalChangeEvent): void {
        current.chordIntervals = chordIntervalChangedEvent.chordIntervals;
        current.toggledIndexes = 0;
        updateScale();
    }

    function scaleFamilyChanged(scaleFamilyChangedEvent: events.ScaleFamilyChangeEvent): void {
        current.scaleFamilyIndex = scaleFamilyChangedEvent.scaleFamily.index;
        current.modeIndex = scaleFamilyChangedEvent.scaleFamily.defaultModeIndex;
        current.chordIndex = -1
        updateScale();
    }

    function midiNote(midiNoteEvent: events.MidiNoteEvent): void {
        current.midiToggledIndexes = midiNoteEvent.toggledIndexes;
        updateScale();
    }

    // setttings event handlers

    function leftHandedChange(leftHandedChangeEvent: events.LeftHandedFretboardEvent): void {
        current.isLeftHanded = leftHandedChangeEvent.isLeftHanded;
        publishStateChange();
    }

    function flipNutChange(flipNutChangeEvent: events.FlipNutEvent): void {
        current.isNutFlipped = flipNutChangeEvent.isNutFlipped;
        publishStateChange();
    }

    function fretboardLabelChange(fretboardLabelChangeEvent: events.FretboardLabelChangeEvent): void {
        current.fretboardLabelType = fretboardLabelChangeEvent.labelType;
        publishStateChange();
    }

    function setCToNoon(setCToNoonEvent: events.SetCToNoonEvent): void {
        current.circleIsCNoon = setCToNoonEvent.isC;
        publishStateChange();
    }

    function tuningChange(tuningChangedEvent: events.TuningChangedEvent): void {
        current.tuningIndex = tuningChangedEvent.index;
        publishStateChange();
    }

    function updateScale(): void {

        let scaleFamily = music.scaleFamily.find(x => x.index == current.scaleFamilyIndex);
        if(!scaleFamily) {
            throw "scaleFamily is " + scaleFamily + ", current.scaleFamilyIndex = " + current.scaleFamilyIndex;
        }
        let mode = scaleFamily.modes.find(x => x.index == current.modeIndex);
        if(!mode) {
            throw "mode is " + mode + "current.modeIndex" + current.modeIndex;
        }
        let noteSpec = music.createNoteSpec(current.naturalIndex, current.index);

        let nodes = music.generateScaleShim(
            noteSpec, 
            mode, 
            current.chordIndex, 
            current.chordIntervals, 
            current.toggledIndexes,
            current.midiToggledIndexes,
            scaleFamily);

        // update togges, because a chord may have been generated.
        current.toggledIndexes = nodes
            .filter(x => x.toggle)
            .map(x => x.scaleNote.note.index)
            .reduce((a, b) => a + 2**b, 0);

        events.scaleChange.publish({
            nodes: nodes,
            mode: mode
        });

        publishStateChange();
    }

    function publishStateChange(): void {
        events.stateChange.publish({
            state: current
        });
    }
}
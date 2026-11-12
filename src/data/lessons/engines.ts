import type { EngineLayout, Powertrain } from '../../state/appState';
import { DIESEL_ENGINE_LESSON, SYSTEM_LESSONS } from './coreSystems';
import type { LessonPartData, QuizQuestion, SystemLessonData } from './types';

function makeEngineParts(sparkName: string, boostPart?: LessonPartData): LessonPartData[] {
  const base = SYSTEM_LESSONS.engine.parts.map((p) =>
    p.id === 'spark-plug' ? { ...p, name: sparkName } : p,
  );
  return boostPart ? [...base, boostPart] : base;
}

const SINGLE_PETROL: SystemLessonData = {
  ...SYSTEM_LESSONS.engine,
  variant: 'single-cylinder',
  glossaryTerms: ['four-stroke', 'piston', 'crankshaft', 'camshaft', 'spark-plug', 'tdc'],
};

const SINGLE_DIESEL: SystemLessonData = {
  ...DIESEL_ENGINE_LESSON,
  variant: 'single-cylinder',
  glossaryTerms: ['four-stroke', 'piston', 'crankshaft', 'camshaft', 'tdc'],
};

function makeMultiCylQuiz(
  layoutLabel: string,
  firingInterval: string,
  balanceFact: string,
  firingOrderStr: string,
): QuizQuestion[] {
  return [
    {
      question: `In a 4-stroke ${layoutLabel}, how many crankshaft degrees separate each combustion power pulse?`,
      options: [
        firingInterval,
        'Every 720° (once every two full turns)',
        'Every 3600°',
        'All cylinders fire at the exact same instant',
      ],
      correctIndex: 0,
      explanation: `With 720° per 4-stroke cycle divided evenly across cylinders, a ${layoutLabel} spaces power strokes every ${firingInterval}.`,
    },
    {
      question: `What is true about the mechanical balance of a ${layoutLabel}?`,
      options: [
        balanceFact,
        'It has zero moving pistons',
        'Its pistons spin sideways around the steering column',
        'It never needs cooling or engine oil',
      ],
      correctIndex: 0,
      explanation: balanceFact,
    },
    {
      question: `What is a typical firing order for a ${layoutLabel}?`,
      options: [
        firingOrderStr,
        'Always 1-1-1-1',
        'Random order chosen per trip',
        'Only cylinder #1 ever ignites',
      ],
      correctIndex: 0,
      explanation: `Engineers choose firing sequences like ${firingOrderStr} to balance crankshaft torque pulses and exhaust scavenging.`,
    },
    {
      question: 'Why does the overhead camshaft still spin at exactly half the crankshaft speed regardless of cylinder count?',
      options: [
        'Each cylinder needs its intake and exhaust valves to open once per two crankshaft turns (720°)',
        'To reduce coolant temperature by half',
        'Because gears cannot spin at 1:1 ratio',
        'To charge the 12V battery faster',
      ],
      correctIndex: 0,
      explanation: 'Even with 3, 4, 6, 8, or 12 cylinders, a 4-stroke cycle always spans 720° of crank travel (2:1 drive ratio).',
    },
    {
      question: 'What role do crankshaft counterweights play in multi-cylinder engines?',
      options: [
        'They offset piston/rod inertia to damp vibration and reduce bearing loads',
        'They pump gasoline from the tank',
        'They shift transmission gears automatically',
        'They inflate the tires',
      ],
      correctIndex: 0,
      explanation: 'Counterweights balance spinning throws and reciprocating big-end mass cleanly across the main bearings.',
    },
  ];
}

const ROTARY_LESSON: SystemLessonData = {
  id: 'engine',
  variant: 'rotary',
  title: 'Wankel Rotary Engine',
  subtitle: 'An orbiting triangular rotor completes all four strokes inside an epitrochoid chamber',
  intro:
    'A Wankel rotary swaps sliding [[piston|pistons]] and valves for a curved three-sided rotor orbiting around an eccentric shaft inside a figure-eight housing. Each rotor face simultaneously breathes, squeezes, fires, and exhausts to spin the shaft effortlessly to high RPM.',
  animationLabel: 'Rotary 3-Face Cycle',
  glossaryTerms: ['four-stroke', 'torque', 'spark-plug'],
  phases: [
    {
      id: 'intake',
      label: '1. Port Intake',
      description: 'Rotor flank sweeps past the side intake port, expanding the pocket to draw fresh air-fuel mix.',
      color: '#38bdf8',
    },
    {
      id: 'compression',
      label: '2. Squeeze',
      description: 'As the rotor orbits past the narrow housing waist, pocket volume shrinks rapidly.',
      color: '#a78bfa',
    },
    {
      id: 'power',
      label: '3. Twin-Spark Burn',
      description: 'Dual spark plugs ignite the spinning flame front, pushing the rotor flank to twist the eccentric shaft.',
      color: '#f59e0b',
    },
    {
      id: 'exhaust',
      label: '4. Exhaust Sweep',
      description: 'The apex tip uncovers the exhaust port cleanly without poppet valves or camshafts.',
      color: '#fb7185',
    },
  ],
  parts: [
    {
      id: 'cylinder-block',
      name: 'Epitrochoid Rotor Housing',
      plainEnglish: 'The peanut-shaped aluminum stator housing coated cleanly for apex seals to glide around.',
      analogy: 'Like a figure-eight racetrack guiding the three-cornered rotor.',
    },
    {
      id: 'piston',
      name: 'Triangular Rotor & Apex Seals',
      plainEnglish: 'A curved Reuleaux triangle dividing the housing into three independent sealed combustion chambers.',
      analogy: 'Like a spinning paddle wheel whose three corners touch the curved wall at all times.',
    },
    {
      id: 'crankshaft',
      name: 'Eccentric Output Shaft',
      plainEnglish: 'Translates the rotor’s wobbly planetary orbit into fast, concentric flywheel rotation (3× rotor speed).',
      analogy: 'Like an off-center bicycle crank turning an orbiting ring into pure spin.',
    },
    {
      id: 'spark-plug',
      name: 'Leading & Trailing Spark Plugs',
      plainEnglish: 'Pair of recessed plugs igniting the long, moving combustion pocket cleanly.',
      analogy: 'Like lighting both ends of a fast-moving campfire trail.',
    },
    {
      id: 'intake-valve',
      name: 'Peripheral Intake Port',
      plainEnglish: 'Precision wall opening uncovered smoothly by the rotor itself—no camshafts or poppet valves needed.',
      analogy: 'Like a sliding doorway that opens on schedule every third of a rotor turn.',
    },
    {
      id: 'exhaust-valve',
      name: 'Exhaust Port',
      plainEnglish: 'Direct wall exit allowing spent gas to blast straight into the exhaust header.',
      analogy: 'Like an open window uncovered as soon as the push is done.',
    },
  ],
  quiz: [
    {
      question: 'How many independent combustion chambers does one triangular Wankel rotor form simultaneously?',
      options: ['Three pockets (one per rotor flank)', 'One chamber only', 'Eight vertical cylinders', 'Zero'],
      correctIndex: 0,
      explanation: 'Each of the three curved flanks forms its own sealed pocket cycling sequentially through Intake, Compression, Power, and Exhaust.',
    },
    {
      question: 'What component seals the three spinning rotor tips against the oval housing wall?',
      options: ['Apex seals', 'Timing belts', 'Rubber O-rings on the muffler', 'Cam lobes'],
      correctIndex: 0,
      explanation: 'Spring-loaded metallic/ceramic apex seals ride along the epitrochoid wall to keep the three pockets gas-tight.',
    },
    {
      question: 'What ratio does the eccentric output shaft spin relative to the triangular rotor itself?',
      options: ['3:1 (shaft spins three times per rotor revolution)', '1:1', '1:2', '10:1'],
      correctIndex: 0,
      explanation: 'Internal phasing gears force a 3:1 ratio—delivering one power pulse per output shaft turn per rotor.',
    },
    {
      question: 'Which familiar reciprocating-engine hardware is completely absent from a Wankel rotary?',
      options: [
        'Camshafts, poppet valves, valve springs, and connecting rods',
        'Spark plugs and fuel',
        'Coolant and radiator',
        'An exhaust manifold',
      ],
      correctIndex: 0,
      explanation: 'Because the rotor itself uncovers housing ports as it orbits, no valvetrain or con-rods exist.',
    },
    {
      question: 'Why are sports cars like the Mazda RX-7/RX-8 famous for using rotary engines?',
      options: [
        'Extremely compact size, low weight, few moving parts, and smooth 9,000 RPM revving',
        'They run purely on seawater',
        'They weigh twice as much as a diesel V12',
        'They produce peak torque only at 500 RPM',
      ],
      correctIndex: 0,
      explanation: 'Small packaging and pure rotational inertia make rotaries light, compact, and eager to rev high.',
    },
  ],
};

function makeInlineOrVOrFlatLesson(
  layout: Exclude<EngineLayout, 'single-cylinder' | 'rotary'>,
  title: string,
  subtitle: string,
  intro: string,
  firingInterval: string,
  balanceFact: string,
  firingOrderStr: string,
): SystemLessonData {
  return {
    id: 'engine',
    variant: layout,
    title,
    subtitle,
    intro,
    animationLabel: 'Firing Sequence',
    glossaryTerms: ['four-stroke', 'piston', 'crankshaft', 'camshaft', 'torque'],
    phases: SYSTEM_LESSONS.engine.phases,
    parts: makeEngineParts('Spark Plug / Ignition Coil'),
    quiz: makeMultiCylQuiz(title, firingInterval, balanceFact, firingOrderStr),
  };
}

const MULTI_ENGINE_LESSONS: Record<Exclude<EngineLayout, 'single-cylinder' | 'rotary'>, SystemLessonData> = {
  i3: makeInlineOrVOrFlatLesson(
    'i3',
    'Inline-3 (I3) Engine',
    'Three upright cylinders sharing a 120° crank for punchy small-car packaging',
    'An Inline-3 lines up three [[piston|pistons]] on crank throws spaced 120° apart. Firing every 240° keeps intake pulses clean without overlapping exhaust pressure—making turbocharging super responsive.',
    '240°',
    'Balanced primary/secondary forces but an inherent end-to-end rocking couple damped by a balance shaft',
    '1 - 2 - 3',
  ),
  i4: makeInlineOrVOrFlatLesson(
    'i4',
    'Inline-4 (I4) Engine',
    'The world’s most common car layout—compact, light, and firing every 180°',
    'Four cylinders stand in a single row above a flat-plane 180° [[crankshaft|crankshaft]] (outer pair up together, inner pair down). Every half-turn of the crank delivers a crisp 4-stroke power pulse.',
    '180°',
    'Zero rocking couple, with mild up-down secondary vibration smoothed by balancer shafts on larger displacements',
    '1 - 3 - 4 - 2',
  ),
  i6: makeInlineOrVOrFlatLesson(
    'i6',
    'Inline-6 (I6) Engine',
    'Silky-smooth six-in-a-row architecture with inherent primary and secondary balance',
    'An Inline-6 pairs mirror-image 120° crank throws (1–6, 2–5, 3–4) so every upward and downward piston inertia cancels out naturally—producing legendary turbine-like smoothness.',
    '120°',
    'Inherently balanced primary forces, secondary forces, and rocking couples without balance shafts',
    '1 - 5 - 3 - 6 - 2 - 4',
  ),
  v6: makeInlineOrVOrFlatLesson(
    'v6',
    '60° V6 Engine',
    'Two angled 3-cylinder banks sharing a compact crankshaft for short hood bays',
    'A V6 splits six cylinders into two angled 3-cylinder banks at 60°, shortening engine length by nearly 40% over an Inline-6 while fitting comfortably across front-wheel-drive or mid-engine bays.',
    '120°',
    'Even 120° firing intervals on split crankpins with compact packaging and mild balance-shaft smoothing',
    '1 - 2 - 3 - 4 - 5 - 6',
  ),
  v8: makeInlineOrVOrFlatLesson(
    'v8',
    '90° Cross-Plane V8 Engine',
    'Two 4-cylinder banks at 90° delivering overlapping 90° power pulses and iconic V8 rumble',
    'A classic cross-plane V8 places crank throws at 90° intervals around two opposing 4-cylinder banks. Every quarter-turn fires another piston—creating effortless low-end [[torque|torque]] and rich exhaust acoustics.',
    '90°',
    'Cross-plane crank counterweights cancel secondary rocking couples cleanly for silky muscle smoothness',
    '1 - 8 - 4 - 3 - 6 - 5 - 7 - 2',
  ),
  v10: makeInlineOrVOrFlatLesson(
    'v10',
    '72° V10 Engine',
    'Ten high-revving cylinders firing every 72° for exotic screaming acoustics',
    'Two 5-cylinder banks meet at 72° around a shared crankshaft, delivering overlapping power pulses every 72° of crank rotation and ferocious high-RPM throttle response.',
    '72°',
    'Lightweight reciprocating internals spin cleanly past 8,500 RPM with split-pin 72° even firing',
    '1 - 6 - 5 - 10 - 2 - 7 - 3 - 8 - 4 - 9',
  ),
  v12: makeInlineOrVOrFlatLesson(
    'v12',
    '60° V12 Engine',
    'Two naturally balanced 6-cylinder banks firing every 60° without torque gaps',
    'Like bolting two silky Inline-6 engines onto one 60° common crankcase, a V12 always has two cylinders pushing on power strokes at once—creating turbine smoothness and majestic top-end surge.',
    '60°',
    'Both 6-cylinder banks are naturally balanced in primary and secondary forces with zero gaps in torque',
    '1 - 7 - 5 - 11 - 3 - 9 - 6 - 12 - 2 - 8 - 4 - 10',
  ),
  'flat-4': makeInlineOrVOrFlatLesson(
    'flat-4',
    'Flat-4 Boxer Engine',
    'Opposed horizontal cylinders punch outward symmetrically to hug the chassis floor',
    'In a 180° Boxer Flat-4, opposing [[piston|pistons]] mirror each other—reaching Top Dead Center simultaneously. Keeping cylinders flat lowers center of gravity sharply for agile cornering.',
    '180°',
    'Opposing pistons cancel primary and secondary horizontal forces naturally like boxers punching gloves together',
    '1 - 3 - 2 - 4',
  ),
  'flat-6': makeInlineOrVOrFlatLesson(
    'flat-6',
    'Flat-6 Boxer Engine',
    'Six horizontally opposed cylinders delivering razor-sharp response and ultra-low CG',
    'A Boxer Flat-6 lays two balanced 3-cylinder banks completely flat across the crank, keeping weight ultra-low in rear- or mid-engine sports cars while singing crisply past 8,000 RPM.',
    '120°',
    'True boxer crankpins cancel opposing horizontal piston forces cleanly with low center of gravity',
    '1 - 6 - 2 - 4 - 3 - 5',
  ),
};

export function getEngineLessonVariant(
  layout: EngineLayout,
  powertrain: Powertrain,
): SystemLessonData {
  if (layout === 'single-cylinder') {
    return powertrain === 'diesel' ? SINGLE_DIESEL : SINGLE_PETROL;
  }
  if (layout === 'rotary') {
    return ROTARY_LESSON;
  }
  const base = MULTI_ENGINE_LESSONS[layout];
  if (powertrain === 'diesel') {
    return {
      ...base,
      title: `${base.title} (Diesel CRDI)`,
      parts: makeEngineParts('High-Pressure Piezo Injector'),
    };
  }
  return base;
}


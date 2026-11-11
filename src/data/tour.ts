import type { Powertrain, SystemId } from '../state/appState';

export interface TourStep {
  id: string;
  stageLabel: string;
  title: string;
  systemId: SystemId;
  requiresXray: boolean;
  narration: string;
  analogy: string;
  /** Relative camera offset around the target system anchor */
  cameraOffset: [number, number, number];
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'fuel',
    stageLabel: 'Fuel',
    title: '1. Fuel Enters the Bay',
    systemId: 'engine',
    requiresXray: true,
    narration:
      'Liquid fuel is pumped forward from the tank and sprayed as a fine mist into the intake ports right above each cylinder.',
    analogy: 'Like a perfume atomizer turning liquid into an easy-to-burn mist.',
    cameraOffset: [1.65, 1.05, 1.65],
  },
  {
    id: 'air',
    stageLabel: 'Air',
    title: '2. Fresh Air Rushes In',
    systemId: 'cooling',
    requiresXray: true,
    narration:
      'Outside air flows through the front grille: part of it feeds the engine cylinders with oxygen, while the rest cools the front radiator.',
    analogy: 'Like taking a deep breath before sprinting—oxygen fuels every burst.',
    cameraOffset: [1.05, 0.72, 1.95],
  },
  {
    id: 'spark',
    stageLabel: 'Spark',
    title: '3. Squeeze & Spark Ignition',
    systemId: 'electrical',
    requiresXray: true,
    narration:
      'The rising piston squeezes air and fuel tightly. Powered by the 12V electrical system, the spark plug jumps a bright arc to ignite it.',
    analogy: 'Like clicking a gas-stove igniter at the exact moment gas arrives.',
    cameraOffset: [-1.45, 1.0, 1.35],
  },
  {
    id: 'power',
    stageLabel: 'Power',
    title: '4. Power Flows Through Gears',
    systemId: 'transmission',
    requiresXray: true,
    narration:
      'Expanding gas slams the piston down, spinning the crankshaft. The transmission matches that spin speed to road torque and sends it along the driveshaft.',
    analogy: 'Like pedaling a multi-speed bike and shifting gears to climb or cruise.',
    cameraOffset: [1.85, 0.92, 0.55],
  },
  {
    id: 'wheels',
    stageLabel: 'Wheels',
    title: '5. Wheels Grip & Brakes Protect',
    systemId: 'brakes',
    requiresXray: false,
    narration:
      'Axles twist the tires forward while suspension springs absorb bumps—and hydraulic brake calipers clamp the discs whenever you need to slow down.',
    analogy: 'Like running shoes gripping pavement while your knees cushion every landing.',
    cameraOffset: [1.45, 0.52, 0.95],
  },
  {
    id: 'exhaust',
    stageLabel: 'Exhaust',
    title: '6. Clean & Quiet Exhaust Exit',
    systemId: 'exhaust',
    requiresXray: true,
    narration:
      'Spent combustion gases flow under the car through a catalytic converter that scrubs pollutants and a muffler that quiets the roar.',
    analogy: 'Like a kitchen range hood combined with an air purifier and sound muffler.',
    cameraOffset: [1.55, 0.62, -1.55],
  },
];

const DIESEL_TOUR_STEPS: TourStep[] = TOUR_STEPS.map((step) => {
  if (step.id === 'fuel') {
    return {
      ...step,
      title: '1. Pure Air Intake',
      narration:
        'A diesel engine draws clean compressed air—without fuel mixed in yet—so the piston can squeeze it cleanly under extreme pressure.',
      analogy: 'Like taking a huge deep lungful of pure air before doing heavy lifting.',
    };
  }
  if (step.id === 'spark') {
    return {
      ...step,
      stageLabel: 'Compress',
      title: '3. Compression Heat Ignition',
      narration:
        'Squeezing air past 500 °C makes high-pressure diesel mist ignite instantaneously upon injection—no spark plugs needed.',
      analogy: 'Like a glowing hot bicycle pump lighting fuel on contact from heat alone.',
    };
  }
  return step;
});

const EV_TOUR_STEPS: TourStep[] = [
  {
    id: 'battery',
    stageLabel: 'Battery',
    title: '1. Underfloor Battery Storage',
    systemId: 'electrical',
    requiresXray: true,
    narration:
      'Low under the cabin floor sits a flat skateboard battery pack storing high-voltage DC electricity while keeping the center of gravity low.',
    analogy: 'Like laying a sleek rechargeable power bank cleanly across the entire floor.',
    cameraOffset: [-1.75, 1.0, 1.2],
  },
  {
    id: 'cooling',
    stageLabel: 'Cooling',
    title: '2. Battery Thermal Loop',
    systemId: 'cooling',
    requiresXray: true,
    narration:
      'Chilled coolant passes through aluminum cold plates beneath the cells and inverter to shed extra heat during fast charging and hard acceleration.',
    analogy: 'Like liquid cold-plates keeping a powerful workstation running evenly.',
    cameraOffset: [1.05, 0.72, 1.95],
  },
  {
    id: 'motor',
    stageLabel: 'Motor',
    title: '3. Copper Stator Spins the Rotor',
    systemId: 'engine',
    requiresXray: true,
    narration:
      'The power inverter sends variable 3-phase AC to stationary stator coils, pulling a magnetic rotor forward silently with instant torque from 0 RPM.',
    analogy: 'Like racing a magnet inside an invisible magnetic carousel ring.',
    cameraOffset: [1.6, 1.0, 1.55],
  },
  {
    id: 'reducer',
    stageLabel: 'Reducer',
    title: '4. Single-Speed Reduction',
    systemId: 'transmission',
    requiresXray: true,
    narration:
      'Because electric motors spin evenly across a huge speed band, a single compact reduction gearset and differential deliver smooth acceleration without shifting.',
    analogy: 'Like a silent, butter-smooth single gear tuned for effortless takeoff and cruising.',
    cameraOffset: [1.85, 0.9, 0.55],
  },
  {
    id: 'regen',
    stageLabel: 'Regen',
    title: '5. Wheels & Regenerative Braking',
    systemId: 'brakes',
    requiresXray: false,
    narration:
      'When you lift off the accelerator or tap the brakes, the electric motor acts in reverse as a generator—slowing the wheels and sending power back to the battery.',
    analogy: 'Like turning your wheel motion backward to refill the tank every time you slow down.',
    cameraOffset: [1.45, 0.52, 0.95],
  },
];

export function getTourSteps(
  powertrain: Powertrain = 'petrol',
  availableSystems?: SystemId[],
): TourStep[] {
  const base =
    powertrain === 'ev'
      ? EV_TOUR_STEPS
      : powertrain === 'diesel'
        ? DIESEL_TOUR_STEPS
        : TOUR_STEPS;
  if (!availableSystems) return base;
  return base.filter((s) => availableSystems.includes(s.systemId));
}


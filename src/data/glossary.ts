export interface GlossaryTerm {
  id: string;
  term: string;
  category: 'Engine' | 'Drivetrain' | 'Chassis' | 'Electrical' | 'Fluids & Emissions';
  shortDef: string;
  analogy: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'piston',
    term: 'Piston',
    category: 'Engine',
    shortDef:
      'A snug metal cylinder that slides up and down inside the engine cylinder as expanding combustion gas pushes on it.',
    analogy: 'Like the plunger inside a bicycle air pump.',
  },
  {
    id: 'crankshaft',
    term: 'Crankshaft',
    category: 'Engine',
    shortDef:
      'An offset spinning shaft that converts the up-and-down stroke of the pistons into continuous rotational power.',
    analogy: 'Like the crank arm and pedals on a bicycle.',
  },
  {
    id: 'camshaft',
    term: 'Camshaft',
    category: 'Engine',
    shortDef:
      'A rotating shaft with egg-shaped lobes (cams) that push intake and exhaust valves open at exact moments, spinning at half the crankshaft speed.',
    analogy: 'Like bumps on a music-box cylinder plucking notes right on beat.',
  },
  {
    id: 'four-stroke',
    term: '4-Stroke Cycle',
    category: 'Engine',
    shortDef:
      'The four repeating steps in most car engines: Intake (pull air & fuel in), Compression (squeeze it), Power (ignite & push down), and Exhaust (push burnt gas out).',
    analogy: 'Suck, squeeze, bang, blow — four beats to one power pulse.',
  },
  {
    id: 'spark-plug',
    term: 'Spark Plug',
    category: 'Engine',
    shortDef:
      'An electrical igniter screwed into the top of a petrol cylinder that jumps a tiny lightning bolt to ignite the squeezed air-fuel mix.',
    analogy: 'Like the flint sparker on a gas stove.',
  },
  {
    id: 'tdc',
    term: 'Top Dead Center (TDC)',
    category: 'Engine',
    shortDef:
      'The highest point a piston reaches inside the cylinder, where the air-fuel mixture is squeezed tightest right before ignition.',
    analogy: 'Like a playground swing reaching its highest peak before swinging back.',
  },
  {
    id: 'torque',
    term: 'Torque',
    category: 'Drivetrain',
    shortDef:
      'Twisting force — how hard the engine or electric motor can twist the wheels to get the car moving from a stop or climb a hill.',
    analogy: 'Like the twisting muscle you use on a wrench to loosen a tight bolt.',
  },
  {
    id: 'transmission-gear',
    term: 'Gear Ratio',
    category: 'Drivetrain',
    shortDef:
      'The size relationship between two meshing gears. Low gears multiply pulling force; high gears trade pulling force for relaxed highway cruising.',
    analogy: 'Like low vs. high gear on a mountain bike.',
  },
  {
    id: 'differential',
    term: 'Differential',
    category: 'Drivetrain',
    shortDef:
      'A gear set between the left and right wheels that lets the outside wheel spin faster than the inside wheel when turning a corner.',
    analogy: 'Like marching band rows where the outside person takes bigger strides around a corner.',
  },
  {
    id: 'hydraulics',
    term: 'Hydraulic Pressure',
    category: 'Chassis',
    shortDef:
      'Using incompressible brake fluid in sealed pipes to multiply the light push of your foot into huge clamping force at the wheels.',
    analogy: 'Like squeezing one end of a sealed water syringe to push a wider plunger with far greater force.',
  },
  {
    id: 'caliper',
    term: 'Brake Caliper',
    category: 'Chassis',
    shortDef:
      'A C-shaped clamp straddling the brake disc that presses friction pads inward whenever hydraulic fluid pushes its pistons.',
    analogy: 'Like a strong pair of pliers squeezing a spinning dinner plate.',
  },
  {
    id: 'damper',
    term: 'Shock Absorber (Damper)',
    category: 'Chassis',
    shortDef:
      'An oil-filled tube inside or beside the suspension spring that turns bouncy spring energy into gentle heat so the car stops bouncing after a bump.',
    analogy: 'Like a screen-door closer that stops a spring-loaded door from slamming or wobbling.',
  },
  {
    id: 'rack-pinion',
    term: 'Rack & Pinion',
    category: 'Chassis',
    shortDef:
      'A small round gear (pinion) turned by your steering wheel that slides a flat toothed bar (rack) sideways to angle the front wheels.',
    analogy: 'Like a sliding gate track moved sideways by a motorized cogwheel.',
  },
  {
    id: 'alternator',
    term: 'Alternator',
    category: 'Electrical',
    shortDef:
      'A small belt-driven generator bolted to the engine that creates electricity while driving to recharge the battery and power lights and computers.',
    analogy: 'Like a bicycle wheel dynamo powering a headlamp as you pedal.',
  },
  {
    id: 'coolant',
    term: 'Coolant & Thermostat',
    category: 'Fluids & Emissions',
    shortDef:
      'A water-and-antifreeze liquid loop regulated by a heat-sensitive valve (thermostat) so the engine warms up quickly and never overheats.',
    analogy: 'Like a home heating valve that circulates water only once it reaches temperature.',
  },
  {
    id: 'catalytic-converter',
    term: 'Catalytic Converter',
    category: 'Fluids & Emissions',
    shortDef:
      'A precious-metal honeycomb chamber in the exhaust pipe that triggers chemical reactions turning toxic gases into carbon dioxide, water, and nitrogen.',
    analogy: 'Like a super-hot chemical filter that scrubs smoke before it leaves the chimney.',
  },
  {
    id: 'compression-ignition',
    term: 'Compression Ignition',
    category: 'Engine',
    shortDef:
      'Squeezing pure air so tightly (around 18:1 to 22:1) that its temperature exceeds 500 °C, allowing injected diesel fuel to ignite spontaneously without spark plugs.',
    analogy: 'Like a hot bicycle pump lighting a puff of mist from squeeze heat alone.',
  },
  {
    id: 'inverter',
    term: 'Power Inverter',
    category: 'Electrical',
    shortDef:
      'Solid-state electronics that convert high-voltage DC from the EV battery into variable-frequency 3-phase AC to control motor speed, and reverse back into DC during regenerative braking.',
    analogy: 'Like a super-fast two-way translator and dimmer switch between a battery and an electric motor.',
  },
  {
    id: 'regenerative-braking',
    term: 'Regenerative Braking',
    category: 'Electrical',
    shortDef:
      'Using the electric motor as a generator when slowing down so vehicle momentum creates electrical drag that recharges the battery instead of wasting energy as brake heat.',
    analogy: 'Like pedaling uphill to wind up a spring clutch that refills your e-bike battery.',
  },
];

export const GLOSSARY_MAP: Record<string, GlossaryTerm> = Object.fromEntries(
  GLOSSARY_TERMS.map((t) => [t.id, t]),
);


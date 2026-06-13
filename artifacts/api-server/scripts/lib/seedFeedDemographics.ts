import {
  CATEGORIES,
  pick,
  pickN,
  randInt,
  type Category,
} from "./seedSocialShared.ts";

export type EthnicProfile = "white" | "black" | "chinese" | "indian" | "hispanic";

export const US_CITIES = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "Austin, TX",
  "Jacksonville, FL",
  "San Jose, CA",
  "Fort Worth, TX",
  "Columbus, OH",
  "Charlotte, NC",
  "Indianapolis, IN",
  "Seattle, WA",
  "Denver, CO",
  "Nashville, TN",
  "Boston, MA",
  "Portland, OR",
  "Las Vegas, NV",
  "Atlanta, GA",
  "Miami, FL",
  "Minneapolis, MN",
  "Tampa, FL",
  "Detroit, MI",
  "Salt Lake City, UT",
  "Raleigh, NC",
  "Kansas City, MO",
  "Omaha, NE",
  "Boise, ID",
  "Richmond, VA",
  "Madison, WI",
  "Charleston, SC",
  "Boulder, CO",
  "Asheville, NC",
  "Savannah, GA",
  "Scottsdale, AZ",
  "Plano, TX",
] as const;

const NAME_BANKS: Record<
  EthnicProfile,
  { first: readonly string[]; last: readonly string[]; menPortraits: readonly number[]; womenPortraits: readonly number[] }
> = {
  white: {
    first: [
      "Sarah", "Emily", "James", "Olivia", "David", "Sophia", "Noah", "Abigail", "Ethan", "Grace",
      "Liam", "Hannah", "Daniel", "Chloe", "Matthew", "Lily", "Benjamin", "Mia", "Samuel", "Emma",
      "Joshua", "Ava", "Caleb", "Zoe", "Andrew", "Natalie", "Isaac", "Leah", "Nathan", "Rachel",
    ],
    last: [
      "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor",
      "Thomas", "Moore", "Martin", "Thompson", "White", "Clark", "Lewis", "Walker", "Hall", "Allen",
    ],
    menPortraits: [0, 2, 5, 8, 12, 15, 18, 22, 30, 35, 40, 45, 50, 55, 60],
    womenPortraits: [1, 3, 6, 9, 11, 14, 17, 21, 25, 32, 38, 44, 50, 56, 63],
  },
  black: {
    first: [
      "Marcus", "Aisha", "DeAndre", "Keisha", "Jamal", "Tanisha", "Malik", "Latoya", "Darius", "Imani",
      "Terrence", "Monique", "Andre", "Shanice", "Jerome", "Ayanna", "Tyrone", "Destiny", "Corey", "Jasmine",
    ],
    last: [
      "Washington", "Jefferson", "Jackson", "Robinson", "Harris", "Scott", "Green", "Carter", "Mitchell", "Turner",
      "Parker", "Collins", "Brooks", "Reed", "Bennett", "Griffin", "Hayes", "Bryant", "Russell", "Powell",
    ],
    menPortraits: [32, 33, 34, 52, 53, 62, 71, 72, 82, 83],
    womenPortraits: [28, 29, 44, 54, 65, 66, 78, 83, 91, 92],
  },
  chinese: {
    first: ["Wei", "Ming", "Li", "Jun", "Mei", "Chen", "Lin", "Hao", "Jia", "Ying", "Xin", "Bo", "Lan", "Qi"],
    last: ["Chen", "Wang", "Li", "Zhang", "Liu", "Huang", "Wu", "Zhou", "Xu", "Sun", "Ma", "Zhu", "Hu", "Guo"],
    menPortraits: [15, 25, 35, 55, 65, 75, 85],
    womenPortraits: [18, 22, 38, 48, 58, 68, 88],
  },
  indian: {
    first: ["Priya", "Arjun", "Anika", "Rohan", "Deepa", "Vikram", "Neha", "Sanjay", "Kavya", "Raj", "Meera", "Amit"],
    last: ["Patel", "Sharma", "Gupta", "Singh", "Kumar", "Reddy", "Nair", "Desai", "Iyer", "Mehta", "Shah", "Rao"],
    menPortraits: [40, 50, 60, 70, 80, 90],
    womenPortraits: [42, 52, 62, 72, 82, 92],
  },
  hispanic: {
    first: ["Maria", "Carlos", "Sofia", "Diego", "Isabella", "Luis", "Camila", "Miguel", "Elena", "Javier", "Lucia", "Rafael"],
    last: [
      "Garcia", "Martinez", "Rodriguez", "Lopez", "Hernandez", "Gonzalez", "Perez", "Sanchez", "Ramirez", "Torres",
      "Flores", "Rivera", "Gomez", "Diaz", "Cruz", "Morales",
    ],
    menPortraits: [10, 20, 30, 41, 51, 61, 81],
    womenPortraits: [12, 24, 36, 46, 56, 66, 86],
  },
};

export interface DemographicUser {
  username: string;
  localPart: string;
  displayName: string;
  location: string;
  categories: string[];
  avatarUrl: string;
  profile: EthnicProfile;
}

export function ethnicityForIndex(index: number, total: number): EthnicProfile {
  const whiteCount = Math.round(total * 0.9);
  if (index < whiteCount) return "white";
  const minorityIndex = index - whiteCount;
  const groups: EthnicProfile[] = ["black", "chinese", "indian", "hispanic"];
  return groups[minorityIndex % groups.length]!;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function portraitUrl(profile: EthnicProfile, female: boolean, index: number): string {
  const bank = NAME_BANKS[profile];
  const portraits = female ? bank.womenPortraits : bank.menPortraits;
  const portraitIndex = portraits[index % portraits.length]!;
  const gender = female ? "women" : "men";
  return `https://randomuser.me/api/portraits/${gender}/${portraitIndex}.jpg`;
}

export function generateDemographicUsers(count: number, reservedUsernames: Set<string>): DemographicUser[] {
  const users: DemographicUser[] = [];
  let attempt = 0;

  while (users.length < count) {
    const profile = ethnicityForIndex(users.length, count);
    const bank = NAME_BANKS[profile];
    const first = pick(bank.first);
    const last = pick(bank.last);
    const female = attempt % 2 === 1;
    const suffix = attempt > 0 ? String(attempt) : "";
    const baseUsername = slugify(`${first}${last}${suffix}`);
    const username = baseUsername.length >= 3 ? baseUsername : `${baseUsername}${users.length}`;

    if (reservedUsernames.has(username)) {
      attempt++;
      continue;
    }
    reservedUsernames.add(username);

    users.push({
      username,
      localPart: `${slugify(first)}.${slugify(last)}${suffix}`,
      displayName: `${first} ${last}`,
      location: pick(US_CITIES),
      categories: pickN(CATEGORIES as unknown as string[], randInt(2, 4)) as Category[],
      avatarUrl: portraitUrl(profile, female, users.length),
      profile,
    });
    attempt++;
  }

  return users;
}

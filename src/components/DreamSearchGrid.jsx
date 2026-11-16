'use client';

import { useState } from 'react';

const DREAM_DATABASE = [
  { symbol: 'Snake / Serpent', meaning: 'Encountering, killing, or seeing a crawling snake', direct: '07, 77, 97', house: '7', ending: '7' },
  { symbol: 'Clear Water / River', meaning: 'Seeing clean water flowing smoothly in a river or spring', direct: '04, 44, 84', house: '4, 8', ending: '4' },
  { symbol: 'Muddy / Dirty Water', meaning: 'Flooding, cloudy or muddy water after heavy rain', direct: '07, 73, 87', house: '7', ending: '3, 7' },
  { symbol: 'Money / Currency Notes', meaning: 'Receiving paper currency or finding paper money', direct: '00, 14, 25', house: '0, 2', ending: '0, 5' },
  { symbol: 'Coins / Metal Money', meaning: 'Hearing jingle of coins or counting brass/silver coins', direct: '03, 33, 53', house: '3', ending: '3' },
  { symbol: 'Fire / Flame', meaning: 'Seeing burning wood, sparks, or bright flame', direct: '06, 60, 66', house: '6', ending: '6' },
  { symbol: 'Smoke', meaning: 'Thick smoke rising without seeing open flame', direct: '08, 80, 88', house: '8', ending: '0, 8' },
  { symbol: 'Fish / Catching Fish', meaning: 'Catching live fish with hands or net', direct: '09, 19, 39, 79', house: '9', ending: '9' },
  { symbol: 'Dog / Puppy', meaning: 'Friendly dog barking or playing with a puppy', direct: '04, 24, 49', house: '2, 4', ending: '4' },
  { symbol: 'Cat', meaning: 'Black or wild cat crossing path', direct: '02, 22, 52', house: '2', ending: '2' },
  { symbol: 'Cow / Bull', meaning: 'Milking a cow or peaceful grazing cattle', direct: '08, 18, 88', house: '1, 8', ending: '8' },
  { symbol: 'Horse / Riding', meaning: 'Riding a fast horse or watching a running horse', direct: '11, 21, 61', house: '1, 6', ending: '1' },
  { symbol: 'Elephant', meaning: 'Seeing a calm or massive elephant walking', direct: '09, 59, 99', house: '5, 9', ending: '9' },
  { symbol: 'Tiger / Leopard', meaning: 'Wild big cat in the forest or jungle path', direct: '09, 29, 89', house: '2, 8', ending: '9' },
  { symbol: 'Bird / Flying', meaning: 'Flock of small birds or eagle flying high', direct: '02, 12, 52', house: '2', ending: '2' },
  { symbol: 'Tree / Forest', meaning: 'Climbing a tall pine tree or walking dense jungle', direct: '08, 48, 88', house: '4, 8', ending: '8' },
  { symbol: 'Flowers / Garden', meaning: 'Blooming orchids or plucking colorful flowers', direct: '01, 15, 51', house: '1, 5', ending: '1, 5' },
  { symbol: 'Eating / Food Feast', meaning: 'Eating meat or sharing a community meal', direct: '01, 10, 21', house: '1, 2', ending: '0, 1' },
  { symbol: 'Funeral / Dead Body', meaning: 'Attending funeral or carrying memorial flowers', direct: '02, 14, 92', house: '2, 9', ending: '2, 4' },
  { symbol: 'Wedding / Bride', meaning: 'Traditional wedding celebration or bride in attire', direct: '03, 13, 33', house: '3', ending: '3' },
  { symbol: 'Blood', meaning: 'Seeing injury, red blood from cut', direct: '05, 55, 75', house: '5', ending: '5' },
  { symbol: 'Rain / Heavy Storm', meaning: 'Monsoon downpour with loud thunder', direct: '04, 14, 44', house: '4', ending: '4' },
  { symbol: 'Sun / Sunrise', meaning: 'Bright morning sunrise or shining sunlight', direct: '01, 10, 91', house: '1', ending: '1' },
  { symbol: 'Moon / Full Moon', meaning: 'Clear white full moon in night sky', direct: '02, 20, 22', house: '2', ending: '2' },
  { symbol: 'Boat / Ship', meaning: 'Rowing a wooden boat on a lake', direct: '03, 33, 73', house: '3', ending: '3' },
  { symbol: 'Car / Vehicle', meaning: 'Driving a motor car or traveling in a bus', direct: '04, 40, 48', house: '4', ending: '4, 8' },
  { symbol: 'Aeroplane / Flying High', meaning: 'Flying inside plane or airplane soaring overhead', direct: '07, 17, 70', house: '7', ending: '7' },
  { symbol: 'Gun / Weapon', meaning: 'Holding a rifle, bullet, or traditional knife', direct: '06, 26, 66', house: '6', ending: '6' },
  { symbol: 'Arrow / Bow', meaning: 'Holding traditional Khasi bamboo bow or quivered arrows', direct: '01, 11, 21', house: '1', ending: '1' },
  { symbol: 'Shoe / Slippers', meaning: 'Wearing new leather shoes or searching for footwear', direct: '08, 28, 88', house: '2, 8', ending: '8' },
  { symbol: 'Gold / Jewelry', meaning: 'Wearing gold necklace or finding gold ring', direct: '08, 18, 58', house: '1, 5', ending: '8' },
  { symbol: 'Police / Soldier', meaning: 'Meeting uniformed officer or police checkpoint', direct: '07, 71, 77', house: '7', ending: '1, 7' },
  { symbol: 'Doctor / Hospital', meaning: 'Visiting medical clinic or taking medicine', direct: '02, 24, 62', house: '2, 6', ending: '2' },
  { symbol: 'Baby / Child Playing', meaning: 'Holding a smiling newborn baby or toddler', direct: '02, 03, 23', house: '2, 3', ending: '3' },
  { symbol: 'Old Man / Woman', meaning: 'Elderly village elder speaking with walking stick', direct: '05, 50, 55', house: '5', ending: '5' },
  { symbol: 'House / Building', meaning: 'Constructing new home or entering a large house', direct: '04, 44, 94', house: '4', ending: '4' },
];

export default function DreamSearchGrid() {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = DREAM_DATABASE.filter(
    (d) =>
      d.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.meaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.direct.includes(searchTerm)
  );

  return (
    <div>
      {/* Search Input Filter */}
      <div style={{ maxWidth: '500px', margin: '0 auto 28px' }}>
        <input
          type="text"
          placeholder="Search your dream (e.g., snake, water, money, flying)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
          style={{ width: '100%', padding: '12px 16px', fontSize: '1rem', borderRadius: '8px' }}
        />
      </div>

      {/* Dream Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '40px' }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No dream symbol found matching &quot;{searchTerm}&quot;. Try another keyword like water, animal, or money.
          </div>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {item.symbol}
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {item.meaning}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  Direct: {item.direct}
                </span>
                <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: 'var(--text-muted)', padding: '3px 8px', borderRadius: '4px' }}>
                  House: {item.house}
                </span>
                <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: 'var(--text-muted)', padding: '3px 8px', borderRadius: '4px' }}>
                  Ending: {item.ending}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

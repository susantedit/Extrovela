import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Memory } from '../../types/memory';
import { Heading, Text } from '../../components/primitives/Typography';
import { Card } from '../../components/primitives/Card';
import { haptics } from '../../utils/haptics';

interface CalendarJournalViewProps {
  memories: Memory[];
  onSelectMemory: (memory: Memory) => void;
}

export const CalendarJournalView: React.FC<CalendarJournalViewProps> = ({
  memories,
  onSelectMemory,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayIndex = new Date(year, monthIndex, 1).getDay();

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayIndex }, (_, i) => i);

  const handlePrevMonth = () => {
    haptics.light();
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    haptics.light();
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  // Group memories for the current month and year
  const memoryDaysMap = new Map<number, Memory[]>();
  memories.forEach(m => {
    const d = new Date(m.completedAt);
    if (d.getFullYear() === year && d.getMonth() === monthIndex) {
      const dayNum = d.getDate();
      const existing = memoryDaysMap.get(dayNum) || [];
      existing.push(m);
      memoryDaysMap.set(dayNum, existing);
    }
  });

  const selectedDayMemories = selectedDay ? memoryDaysMap.get(selectedDay) || [] : [];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Month Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          onClick={handlePrevMonth}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: '#F6F1E7',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <Text variant="caption" style={{ color: '#C99A45', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
            MY MONTH IN EXPERIENCES
          </Text>
          <Heading variant="headingMD" style={{ fontFamily: 'serif', color: '#F6F1E7', marginTop: '2px' }}>
            {`${monthName} ${year}`}
          </Heading>
        </div>

        <button
          onClick={handleNextMonth}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: '#F6F1E7',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar Grid Container */}
      <div style={{ backgroundColor: 'rgba(32, 33, 27, 0.7)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(201, 154, 69, 0.2)', marginBottom: '24px' }}>
        {/* Days of week */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '12px' }}>
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
            <Text key={i} variant="caption" style={{ color: 'rgba(246, 241, 231, 0.4)', fontWeight: 600, fontSize: '11px' }}>
              {d}
            </Text>
          ))}
        </div>

        {/* Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {emptyDays.map(i => (
            <div key={`empty_${i}`} style={{ height: '42px' }} />
          ))}
          {daysArray.map(day => {
            const dayMems = memoryDaysMap.get(day) || [];
            const hasMemories = dayMems.length > 0;
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => {
                  haptics.selection();
                  setSelectedDay(day);
                }}
                style={{
                  height: '42px',
                  borderRadius: '10px',
                  border: isSelected ? '1px solid #C99A45' : '1px solid transparent',
                  backgroundColor: isSelected
                    ? 'rgba(201, 154, 69, 0.25)'
                    : hasMemories
                    ? 'rgba(201, 154, 69, 0.12)'
                    : 'transparent',
                  color: isSelected ? '#C99A45' : '#F6F1E7',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: isSelected || hasMemories ? 600 : 400 }}>{day}</span>
                {hasMemories && (
                  <div style={{ display: 'flex', gap: '3px', marginTop: '3px' }}>
                    {dayMems.slice(0, 3).map((m, idx) => (
                      <div
                        key={m.id || idx}
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: m.isFavorite ? '#F59E0B' : '#C99A45',
                        }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Memories */}
      <div>
        <Text variant="label" style={{ color: 'rgba(246, 241, 231, 0.6)', textTransform: 'uppercase', marginBottom: '12px', display: 'block', fontSize: '12px' }}>
          {selectedDay ? `${monthName} ${selectedDay} EXPERIENCES (${selectedDayMemories.length})` : 'SELECT A DAY TO VIEW STORIES'}
        </Text>

        {selectedDayMemories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <Text variant="bodySM" color="secondary" style={{ fontStyle: 'italic' }}>
              Your story is waiting. No logged experiences on this date.
            </Text>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDayMemories.map(mem => (
              <Card
                key={mem.id}
                onClick={() => {
                  haptics.light();
                  onSelectMemory(mem);
                }}
                style={{
                  backgroundColor: 'rgba(32, 33, 27, 0.85)',
                  border: '1px solid rgba(201, 154, 69, 0.2)',
                  padding: '16px',
                  display: 'flex',
                  gap: '14px',
                  cursor: 'pointer',
                  borderRadius: '12px',
                }}
              >
                {(mem.photoUrl || (mem.photos && mem.photos.length > 0)) && (
                  <div style={{ width: '68px', height: '68px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                    <img
                      src={mem.photoUrl || (mem.photos && mem.photos[0].downloadUrl)}
                      alt={mem.title || mem.questTitle}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <Heading variant="headingMD" style={{ color: '#F6F1E7', fontSize: '15px' }}>
                      {mem.title || mem.questTitle}
                    </Heading>
                    <span style={{ fontSize: '12px', color: '#C99A45' }}>{'★'.repeat(mem.rating || mem.moodRating || 5)}</span>
                  </div>
                  <Text variant="caption" style={{ color: '#C99A45', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                    📍 {mem.location.city} {mem.mood ? `• ${mem.mood}` : ''}
                  </Text>
                  <Text variant="bodySM" style={{ color: 'rgba(246, 241, 231, 0.75)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    "{mem.reflectionText}"
                  </Text>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarJournalView;

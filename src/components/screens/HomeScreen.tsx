import React, { useState } from 'react';
import { Sparkles, Compass, MapPin, ArrowRight, Zap, Coffee, Eye, Heart, Bell } from 'lucide-react';
import { Quest, Memory } from '../../types';
import { QuestCard, Card, Button, Badge, Heading, Text, SectionHeader, BottomSheet } from '../primitives';
import { triggerHaptic } from '../../lib/native-device';
import { NotificationInboxModal } from '../../features/notifications';
import { useAppState } from '../../context/AppStateContext';
import { useAuth } from '../../context/AuthContext';
import { QuestSpinnerModal } from '../QuestSpinnerModal';

interface HomeScreenProps {
  onNavigateTab: (tab: 'home' | 'explore' | 'map' | 'memories' | 'profile') => void;
  onStartQuest: (quest: Quest) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateTab, onStartQuest }) => {
  const { city, activeQuest, quests, memories, stats, preferences } = useAppState();
  const { user } = useAuth();
  const [selectedQuickEscape, setSelectedQuickEscape] = useState<Quest | null>(null);
  const [isQuickSheetOpen, setIsQuickSheetOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isSpinnerOpen, setIsSpinnerOpen] = useState(false);

  // Dynamic Time & Date Calculations
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const hour = now.getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userName = user?.displayName || 'Explorer';

  // Dynamic Featured Quest (activeQuest or first top quest)
  const featuredQuest = activeQuest || quests[0];

  const handleQuickAction = () => {
    triggerHaptic('medium');
    setIsSpinnerOpen(true);
  };

  return (
    <div className="container py-24 screen-enter" style={{ maxWidth: 880 }}>
      {/* 1. Header Greeting & Context (Dynamic) */}
      <div className="mb-28 animate-stagger-1">
        <div className="flex items-center justify-between mb-8">
          <Badge variant="brand" mono>
            {city.toUpperCase()} • {dayName.toUpperCase()}
          </Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn-icon"
              onClick={() => {
                triggerHaptic('light');
                setIsInboxOpen(true);
              }}
              title="Notification Inbox"
            >
              <Bell size={18} style={{ color: 'var(--color-accent)' }} />
            </button>
            <span className="font-mono text-xs text-muted">Active Session • Solo</span>
          </div>
        </div>

        <Heading variant="display" style={{ fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 900, lineHeight: 1.15 }}>
          {timeGreeting}, {userName}.
          <br />
          <span className="text-accent">Your world is waiting.</span>
        </Heading>
        <Text variant="bodyMD" color="secondary" style={{ marginTop: 8, maxWidth: 540 }}>
          Don't just get through your day. Pick a small real-world experience and make today different.
        </Text>
      </div>

      {/* 2. Today's Quest (Dynamic Featured Card) */}
      {featuredQuest && (
        <div className="mb-36 animate-stagger-2">
          <QuestCard
            quest={featuredQuest}
            isTodayFeatured
            onStart={onStartQuest}
          />
        </div>
      )}

      {/* 3. Small Escape / "I'm Bored" Action */}
      <div className="mb-36 animate-stagger-3">
        <Card
          interactive
          onClick={handleQuickAction}
          style={{
            padding: '24px 28px',
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border-accent)',
            cursor: 'pointer',
          }}
        >
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="flex items-center gap-16">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(201, 154, 69, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap style={{ width: 24, height: 24, color: 'var(--color-accent)' }} />
              </div>
              <div>
                <span className="font-mono text-xs text-accent font-bold uppercase block mb-2">SMALL ESCAPE</span>
                <Heading variant="headingMD" style={{ fontSize: 18, marginBottom: 2 }}>
                  Only have 20 minutes?
                </Heading>
                <Text variant="bodySM" color="secondary">
                  "I don't know what to do." — One tap instant micro-adventure.
                </Text>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                handleQuickAction();
              }}
              rightIcon={<ArrowRight style={{ width: 14, height: 14 }} />}
            >
              <span>Give me something</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* 4. "Your World" Exploration Preview */}
      <div className="mb-36 animate-stagger-4">
        <SectionHeader
          title="Your World"
          subtitle="How much of your city have you personally experienced?"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigateTab('map')} rightIcon={<ArrowRight style={{ width: 14, height: 14 }} />}>
              <span>Explore Map</span>
            </Button>
          }
        />

        <div className="grid-2">
          <Card style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-12">
              <span className="form-label" style={{ marginBottom: 0 }}>Exploration Progress</span>
              <span className="font-mono text-xs text-accent font-bold">{stats.cityExplorationPercent}% personally explored</span>
            </div>
            <div style={{ height: 8, background: 'var(--color-surface-elevated)', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${Math.min(stats.cityExplorationPercent || 10, 100)}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 99 }} />
            </div>
            <Text variant="bodySM" color="muted">
              {stats.uniqueLocationsVisited || 0} places discovered across {city}.
            </Text>
          </Card>

          <Card style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-12">
              <span className="form-label" style={{ marginBottom: 0 }}>Experience Archetype</span>
              <Badge variant="brand" mono>{stats.explorerArchetype || 'Urban Flâneur'}</Badge>
            </div>
            <Text variant="bodySM" color="secondary" style={{ lineHeight: 1.6 }}>
              {stats.outdoorPercentage || 70}% outdoor adventures • {stats.soloPercentage || 85}% solo mindful moments.
            </Text>
          </Card>
        </div>
      </div>

      {/* 5. Recent Memory Preview */}
      <div>
        <SectionHeader
          title="Recent Story"
          subtitle="Every completed quest becomes a lasting real-world memory."
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigateTab('memories')} rightIcon={<ArrowRight style={{ width: 14, height: 14 }} />}>
              <span>View All ({memories.length})</span>
            </Button>
          }
        />

        {memories.length > 0 ? (
          <Card
            interactive
            onClick={() => onNavigateTab('memories')}
            style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              <div style={{ height: 220, position: 'relative' }}>
                <img
                  src={memories[0].photoUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'}
                  alt={memories[0].questTitle}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span className="font-mono text-xs text-accent font-bold uppercase mb-4">LATEST DISCOVERY</span>
                <Heading variant="headingMD" style={{ fontSize: 18, marginBottom: 8 }}>
                  {memories[0].questTitle}
                </Heading>
                <Text variant="bodySM" color="secondary" style={{ fontStyle: 'italic', marginBottom: 14, lineHeight: 1.6 }}>
                  "{memories[0].reflectionText}"
                </Text>
                <div className="flex items-center gap-6 text-xs text-muted font-mono">
                  <MapPin style={{ width: 12, height: 12, color: 'var(--color-accent)' }} />
                  <span>{memories[0].location.placeName || `${city} Discovery Point`}</span>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 24, textAlign: 'center' }}>
            <Text variant="bodyMD" color="secondary">
              No memories recorded yet. Complete today's quest to unlock your first discovery on the map!
            </Text>
          </Card>
        )}
      </div>

      {/* Quick Escape Bottom Sheet */}
      <BottomSheet
        isOpen={isQuickSheetOpen}
        onClose={() => setIsQuickSheetOpen(false)}
        title="Your Quick Escape"
      >
        {selectedQuickEscape && (
          <div className="flex flex-col gap-16">
            <Badge variant="accent" mono>{selectedQuickEscape.category}</Badge>
            <Heading variant="headingLG">{selectedQuickEscape.title}</Heading>
            <Text variant="bodyMD" color="secondary" style={{ lineHeight: 1.6 }}>
              {selectedQuickEscape.description}
            </Text>
            <div className="flex gap-12 mt-8">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => {
                  setIsQuickSheetOpen(false);
                  onStartQuest(selectedQuickEscape);
                }}
              >
                <span>ACCEPT QUICK ESCAPE</span>
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Notification Inbox Modal */}
      <NotificationInboxModal
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        onNavigateDeepLink={link => {
          if (link.includes('quest/') && featuredQuest) {
            onStartQuest(featuredQuest);
          }
        }}
      />

      {/* Instant Quest Spinner Modal */}
      <QuestSpinnerModal
        isOpen={isSpinnerOpen}
        onClose={() => setIsSpinnerOpen(false)}
        onSelectQuest={quest => {
          onStartQuest(quest);
        }}
      />
    </div>
  );
};

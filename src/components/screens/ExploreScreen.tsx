import React, { useState, useMemo } from 'react';
import { Compass, Sparkles, Filter, Trees, Coffee, Camera, Zap, Users, ArrowRight } from 'lucide-react';
import { Quest } from '../../types';
import { Card, Button, Badge, Heading, Text, SectionHeader, QuestCard } from '../primitives';
import { triggerHaptic } from '../../lib/native-device';
import { useAppState } from '../../context/AppStateContext';

interface ExploreScreenProps {
  onStartQuest: (quest: Quest) => void;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({ onStartQuest }) => {
  const { quests, city } = useAppState();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Dynamically extract categories from all loaded quests
  const dynamicCategories = useMemo(() => {
    const categoryMap = new Map<string, { count: number; sampleImage: string }>();
    quests.forEach(q => {
      const existing = categoryMap.get(q.category) || { count: 0, sampleImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80' };
      categoryMap.set(q.category, {
        count: existing.count + 1,
        sampleImage: q.category.includes('Cafe') ? 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80' :
                     q.category.includes('Outdoor') || q.category.includes('Nature') ? 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80' :
                     q.category.includes('Social') ? 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80' :
                     existing.sampleImage,
      });
    });
    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      id: name.toLowerCase(),
      name,
      questCount: data.count,
      featuredImage: data.sampleImage,
      tagline: `Curated ${name.toLowerCase()} adventures in ${city}`,
    }));
  }, [quests, city]);

  const filteredQuests = selectedCategory === 'all'
    ? quests
    : quests.filter(q => q.category.toLowerCase().includes(selectedCategory.toLowerCase()));

  return (
    <div className="container py-32 screen-enter" style={{ maxWidth: 880 }}>
      {/* Header */}
      <div className="mb-32">
        <Badge variant="brand" mono className="mb-8">CURATED EXPERIENCES</Badge>
        <Heading variant="display" style={{ fontSize: 'clamp(26px, 5vw, 40px)', fontWeight: 900 }}>
          Explore by Mood & Rhythm
        </Heading>
        <Text variant="bodyMD" color="secondary" style={{ marginTop: 8 }}>
          Discover hand-crafted experiences categorized by sensation, pace, and environment.
        </Text>
      </div>

      {/* Category Cards Grid */}
      <div className="mb-36">
        <SectionHeader title="Thematic Dimensions" subtitle="Choose how you want today to feel" />
        <div className="grid-3">
          {dynamicCategories.map(cat => (
            <Card
              key={cat.id}
              interactive
              onClick={() => {
                triggerHaptic('light');
                setSelectedCategory(cat.name.toLowerCase() === selectedCategory.toLowerCase() ? 'all' : cat.name);
              }}
              style={{
                padding: 0,
                cursor: 'pointer',
                borderColor: selectedCategory === cat.id ? 'var(--color-border-accent)' : 'var(--color-border)',
              }}
            >
              <div style={{ position: 'relative', height: 130, overflow: 'hidden' }}>
                <img src={cat.featuredImage} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                <div style={{ position: 'absolute', bottom: 10, left: 14 }}>
                  <span className="font-display font-bold text-sm text-primary" style={{ color: '#fff' }}>{cat.name}</span>
                </div>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <Text variant="bodySM" color="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                  {cat.tagline}
                </Text>
                <div className="flex items-center justify-between mt-10 pt-8 border-top text-xs font-mono text-muted">
                  <span>{cat.questCount} experiences</span>
                  <span className="text-accent">View →</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Featured Experiences in Selected Category */}
      <div>
        <SectionHeader
          title={selectedCategory === 'all' ? 'All Experience Quests' : `Quests in ${selectedCategory}`}
          subtitle="Real-world invitations waiting for your footsteps"
        />
        <div className="flex flex-col gap-20">
          {filteredQuests.map(quest => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onStart={onStartQuest}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

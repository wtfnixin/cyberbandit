import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LeaderboardEntry {
  id?: string;
  name: string;
  score: number;
  avatarUrl?: string;
  rank?: number;
}

interface LeaderboardViewProps {
  leaderboard: LeaderboardEntry[];
  onBack?: () => void;
  title?: string;
  subtitle?: string;
}

// Retro 8-bit Pixel Avatars SVGs for Top Ranks & Generated Teams
const PixelAvatar: React.FC<{ seed: string; rank?: number; size?: number }> = ({ seed, rank, size = 72 }) => {
  // Seed hash for deterministic selection for ranks > 3
  const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  if (rank === 1) {
    // Rank 1: Pixel Knight with Crown
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: 'pixelated' }}>
        <rect width="24" height="24" rx="4" fill="#3a4b3d" />
        {/* Helmet Base */}
        <rect x="6" y="7" width="12" height="12" fill="#2d3748" />
        <rect x="5" y="9" width="14" height="8" fill="#4a5568" />
        <rect x="8" y="6" width="8" height="2" fill="#1a202c" />
        {/* Visor slit */}
        <rect x="7" y="11" width="10" height="3" fill="#111827" />
        {/* Eye glow */}
        <rect x="8" y="12" width="3" height="1" fill="#fbbf24" />
        <rect x="13" y="12" width="3" height="1" fill="#fbbf24" />
        {/* Mouth grille */}
        <rect x="10" y="15" width="4" height="3" fill="#1a202c" />
        <rect x="11" y="15" width="2" height="3" fill="#4a5568" />
        {/* Crown */}
        <path d="M7 3 L9 6 L12 3 L15 6 L17 3 L16 7 L8 7 Z" fill="#f59e0b" />
        <rect x="11" y="4" width="2" height="2" fill="#fef08a" />
      </svg>
    );
  }

  if (rank === 2) {
    // Rank 2: Skeleton with Hat & Pipe
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: 'pixelated' }}>
        <rect width="24" height="24" rx="4" fill="#0891b2" />
        {/* Skull Head */}
        <rect x="7" y="8" width="10" height="10" fill="#f8fafc" />
        {/* Eye sockets */}
        <rect x="8" y="10" width="3" height="3" fill="#0f172a" />
        <rect x="13" y="10" width="3" height="3" fill="#0f172a" />
        {/* Nose */}
        <rect x="11" y="13" width="2" height="2" fill="#0f172a" />
        {/* Teeth */}
        <rect x="9" y="16" width="6" height="2" fill="#0f172a" />
        <rect x="10" y="16" width="1" height="2" fill="#f8fafc" />
        <rect x="12" y="16" width="1" height="2" fill="#f8fafc" />
        <rect x="14" y="16" width="1" height="2" fill="#f8fafc" />
        {/* Hat */}
        <rect x="5" y="7" width="14" height="2" fill="#78350f" />
        <rect x="7" y="4" width="10" height="3" fill="#78350f" />
        <rect x="7" y="6" width="10" height="1" fill="#f59e0b" />
        {/* Pipe */}
        <rect x="14" y="15" width="5" height="1" fill="#b45309" />
        <rect x="18" y="13" width="2" height="3" fill="#b45309" />
        <rect x="18" y="12" width="2" height="1" fill="#cbd5e1" />
      </svg>
    );
  }

  if (rank === 3) {
    // Rank 3: Alien / Goblin with Party Hat
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: 'pixelated' }}>
        <rect width="24" height="24" rx="4" fill="#65a30d" />
        {/* Head */}
        <rect x="7" y="8" width="10" height="9" fill="#84cc16" />
        {/* Eyes */}
        <rect x="8" y="10" width="3" height="3" fill="#ffffff" />
        <rect x="13" y="10" width="3" height="3" fill="#ffffff" />
        <rect x="9" y="11" width="1" height="1" fill="#000000" />
        <rect x="14" y="11" width="1" height="1" fill="#000000" />
        {/* Mouth */}
        <rect x="9" y="14" width="6" height="1" fill="#3f6212" />
        {/* Shirt */}
        <rect x="6" y="17" width="12" height="5" fill="#2563eb" />
        <rect x="10" y="18" width="4" height="3" fill="#f59e0b" />
        {/* Hat */}
        <rect x="6" y="6" width="12" height="2" fill="#be185d" />
        <rect x="8" y="4" width="8" height="2" fill="#be185d" />
        <circle cx="12" cy="3" r="1.5" fill="#f59e0b" />
      </svg>
    );
  }

  // Generic Retro Avatars (4+)
  const bgColors = ['#1e1b4b', '#172554', '#064e3b', '#451a03', '#312e81'];
  const skinColors = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const bgColor = bgColors[hash % bgColors.length];
  const skinColor = skinColors[(hash + 2) % skinColors.length];

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: 'pixelated' }}>
      <rect width="24" height="24" rx="4" fill={bgColor} />
      <rect x="7" y="8" width="10" height="9" fill={skinColor} />
      <rect x="8" y="10" width="2" height="2" fill="#000" />
      <rect x="14" y="10" width="2" height="2" fill="#000" />
      <rect x="10" y="14" width="4" height="1" fill="#000" />
      <rect x="6" y="17" width="12" height="5" fill="#334155" />
    </svg>
  );
};

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  leaderboard,
  onBack,
  title = "LEADERBOARD",
  subtitle = "BATTLE FOR SUPREMACY"
}) => {
  // Sort leaderboard entries by score descending
  const sorted = [...leaderboard].sort((a, b) => b.score - a.score);

  // Top 3 Podium allocation
  const rank1 = sorted[0];
  const rank2 = sorted[1];
  const rank3 = sorted[2];

  // Rest of the list (Rank 4+) or full list in table
  const fullList = sorted;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#040711',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.15) 0%, rgba(4, 7, 17, 0.95) 70%)',
      color: '#f8fafc',
      padding: '24px 20px',
      boxSizing: 'border-box',
      overflowY: 'auto',
      fontFamily: "'JetBrains Mono', monospace"
    }}>
      {/* Header Bar */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
        textAlign: 'center'
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#94a3b8',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 700,
              transition: 'all 0.2s ease'
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}

        <h1 style={{
          fontSize: '2.4rem',
          fontWeight: 900,
          color: '#818cf8',
          textShadow: '0 0 25px rgba(129, 140, 248, 0.6), 0 0 10px rgba(129, 140, 248, 0.4)',
          letterSpacing: '4px',
          margin: 0,
          textTransform: 'uppercase'
        }}>
          {title}
        </h1>
        
        <div style={{
          fontSize: '0.75rem',
          color: '#94a3b8',
          letterSpacing: '3px',
          marginTop: '6px',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}>
          {subtitle}
        </div>
      </div>

      {/* Main Container */}
      <div style={{
        maxWidth: '1000px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
      }}>
        
        {/* Top 3 Podium Cards Section */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: '20px',
          padding: '20px 0 10px 0',
          position: 'relative'
        }}>

          {/* Left Arrow Icon */}
          <div style={{
            position: 'absolute',
            left: '-10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer'
          }}>
            <ChevronLeft size={36} />
          </div>

          {/* Right Arrow Icon */}
          <div style={{
            position: 'absolute',
            right: '-10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer'
          }}>
            <ChevronRight size={36} />
          </div>

          {/* Rank 2 - Left Card */}
          <motion.div
            layout
            key={rank2 ? (rank2.id || rank2.name) : 'rank-2-empty'}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              width: '200px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '2px solid rgba(148, 163, 184, 0.4)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
              borderRadius: '12px',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              backdropFilter: 'blur(12px)',
              zIndex: 1
            }}
          >
            {/* Rank 2 Badge */}
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '12px',
              background: '#64748b',
              color: '#ffffff',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 900,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
              border: '2px solid #ffffff'
            }}>
              2
            </div>

            {rank2 ? (
              <>
                <div style={{ marginBottom: '14px', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}>
                  <PixelAvatar seed={rank2.name} rank={2} size={84} />
                </div>

                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#f8fafc',
                  textAlign: 'center',
                  marginBottom: '10px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '170px'
                }}>
                  {rank2.name}
                </div>

                <div style={{
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  color: '#e2e8f0',
                  letterSpacing: '0.5px'
                }}>
                  {rank2.score}
                </div>
              </>
            ) : (
              <div style={{ color: '#475569', fontSize: '0.8rem', padding: '30px 0' }}>Waiting...</div>
            )}
          </motion.div>

          {/* Rank 1 - Middle Prominent Card */}
          <motion.div
            layout
            key={rank1 ? (rank1.id || rank1.name) : 'rank-1-empty'}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              width: '230px',
              background: 'rgba(24, 20, 10, 0.85)',
              border: '2px solid #eab308',
              boxShadow: '0 0 35px rgba(234, 179, 8, 0.35), 0 10px 40px rgba(0, 0, 0, 0.8)',
              borderRadius: '14px',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              backdropFilter: 'blur(12px)',
              transform: 'translateY(-12px)',
              zIndex: 2
            }}
          >
            {/* Rank 1 Crown & Badge */}
            <div style={{
              position: 'absolute',
              top: '-16px',
              left: '14px',
              background: '#eab308',
              color: '#000000',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 900,
              boxShadow: '0 0 15px rgba(234, 179, 8, 0.8)',
              border: '2px solid #fef08a'
            }}>
              1
            </div>

            <div style={{
              position: 'absolute',
              top: '-28px',
              display: 'flex',
              gap: '4px'
            }}>
              <Crown size={28} style={{ color: '#eab308', filter: 'drop-shadow(0 0 8px rgba(234, 179, 8, 0.8))' }} />
            </div>

            {rank1 ? (
              <>
                <div style={{ marginBottom: '14px', filter: 'drop-shadow(0 0 15px rgba(234, 179, 8, 0.4))' }}>
                  <PixelAvatar seed={rank1.name} rank={1} size={96} />
                </div>

                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  color: '#fef08a',
                  textAlign: 'center',
                  marginBottom: '10px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '190px'
                }}>
                  {rank1.name}
                </div>

                <div style={{
                  fontSize: '1.45rem',
                  fontWeight: 900,
                  color: '#f59e0b',
                  textShadow: '0 0 12px rgba(245, 158, 11, 0.6)',
                  letterSpacing: '0.5px'
                }}>
                  {rank1.score}
                </div>
              </>
            ) : (
              <div style={{ color: '#475569', fontSize: '0.8rem', padding: '30px 0' }}>Waiting...</div>
            )}
          </motion.div>

          {/* Rank 3 - Right Card */}
          <motion.div
            layout
            key={rank3 ? (rank3.id || rank3.name) : 'rank-3-empty'}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              width: '200px',
              background: 'rgba(28, 18, 12, 0.75)',
              border: '2px solid rgba(217, 119, 6, 0.5)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
              borderRadius: '12px',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              backdropFilter: 'blur(12px)',
              zIndex: 1
            }}
          >
            {/* Rank 3 Badge */}
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '12px',
              background: '#b45309',
              color: '#ffffff',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 900,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
              border: '2px solid #fdba74'
            }}>
              3
            </div>

            {rank3 ? (
              <>
                <div style={{ marginBottom: '14px', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}>
                  <PixelAvatar seed={rank3.name} rank={3} size={84} />
                </div>

                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#fdba74',
                  textAlign: 'center',
                  marginBottom: '10px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '170px'
                }}>
                  {rank3.name}
                </div>

                <div style={{
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  color: '#f97316',
                  letterSpacing: '0.5px'
                }}>
                  {rank3.score}
                </div>
              </>
            ) : (
              <div style={{ color: '#475569', fontSize: '0.8rem', padding: '30px 0' }}>Waiting...</div>
            )}
          </motion.div>
        </div>

        {/* Bottom Team Rankings Table (Full Width) */}
        <div style={{
          background: 'rgba(8, 12, 24, 0.85)',
          border: '1.5px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 0 25px rgba(168, 85, 247, 0.15)',
          borderRadius: '12px',
          padding: '24px',
          backdropFilter: 'blur(16px)'
        }}>
          {/* Box Header */}
          <div style={{
            fontSize: '1.05rem',
            fontWeight: 900,
            color: '#38bdf8',
            letterSpacing: '1px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Trophy size={20} style={{ color: '#38bdf8' }} />
            <span>TEAM RANKINGS</span>
          </div>

          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr 140px',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <span>RANK</span>
            <span>TEAM</span>
            <span style={{ textAlign: 'right' }}>SCORE</span>
          </div>

          {/* List of Teams with Animated Position Transitions */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence>
              {fullList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#64748b', fontSize: '0.85rem' }}>
                  No participants active yet.
                </div>
              ) : (
                fullList.map((team, idx) => {
                  const rankNum = idx + 1;
                  
                  // Badge styling based on rank
                  let badgeBg = '#334155';
                  let badgeColor = '#cbd5e1';
                  let scoreColor = '#cbd5e1';

                  if (rankNum === 1) {
                    badgeBg = '#eab308';
                    badgeColor = '#000000';
                    scoreColor = '#f59e0b';
                  } else if (rankNum === 2) {
                    badgeBg = '#94a3b8';
                    badgeColor = '#000000';
                    scoreColor = '#e2e8f0';
                  } else if (rankNum === 3) {
                    badgeBg = '#b45309';
                    badgeColor = '#ffffff';
                    scoreColor = '#f97316';
                  }

                  return (
                    <motion.div
                      layout
                      key={team.id || team.name}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px 1fr 140px',
                        padding: '14px 16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        alignItems: 'center',
                        background: rankNum % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                        borderRadius: '6px',
                        margin: '2px 0'
                      }}
                    >
                      {/* Rank Badge */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: badgeBg,
                          color: badgeColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 900
                        }}>
                          {rankNum}
                        </div>
                      </div>

                      {/* Team Name */}
                      <div style={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: rankNum === 1 ? '#fef08a' : '#f8fafc',
                        letterSpacing: '0.3px'
                      }}>
                        {team.name}
                      </div>

                      {/* Score */}
                      <div style={{
                        textAlign: 'right',
                        fontWeight: 900,
                        fontSize: '1.05rem',
                        color: scoreColor
                      }}>
                        {team.score}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
};

import PlayerCard from './PlayerCard'

export default function CoachCard({ coach, ...props }) {
  const coachAsPlayer = {
    ...coach,
    position: 'COACH',
  }
  return <PlayerCard {...props} player={coachAsPlayer} />
}

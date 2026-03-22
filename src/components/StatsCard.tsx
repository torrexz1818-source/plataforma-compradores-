import { Users, BookOpen, MessageSquare, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

const iconMap: Record<string, React.ElementType> = {
  users: Users,
  book: BookOpen,
  message: MessageSquare,
  trophy: Trophy,
};

interface StatsCardProps {
  label: string;
  value: string;
  icon: string;
  index: number;
}

const StatsCard = ({ label, value, icon, index }: StatsCardProps) => {
  const Icon = iconMap[icon] || Users;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="bg-card rounded-lg shadow-smooth p-5 flex items-center gap-4 hover:shadow-smooth-hover transition-shadow"
    >
      <div className="w-11 h-11 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary-foreground" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
};

export default StatsCard;

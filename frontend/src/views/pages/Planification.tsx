import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlanningWizard from '../../components/PlanningWizard';

const Planification: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header avec retour */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-lg transition-colors"
          >
            ← Retour à l'accueil
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-200">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text">
            Atelier de Planification
          </h1>
          <PlanningWizard />
        </div>
      </div>
    </div>
  );
};

export default Planification;

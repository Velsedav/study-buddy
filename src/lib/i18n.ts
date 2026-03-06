import { useSettings } from './settings';

type Translations = Record<string, Record<string, string>>;

export const pt: Translations = {
    // English
    en: {
        'nav.subjects': 'Subjects',
        'nav.planner': 'Planner',
        'nav.learning': 'Learning',
        'nav.analytics': 'Analytics',
        'nav.settings': 'Settings',
        'nav.metacognition_logs': 'Metacognition Logs',

        'home.dashboard': 'Dashboard',
        'home.tag': 'Tag',
        'home.all_tags': 'All Tags',
        'home.subject': 'Subject',
        'home.all_subjects': 'All Subjects',
        'home.new_subject': '+ New Subject',
        'home.consistency': '35-Day Consistency',
        'home.heatmap_desc': 'Your recent study heatmap.',
        'home.less': 'Less',
        'home.more': 'More',

        'settings.appearance': 'Appearance',
        'settings.theme': 'Theme',
        'settings.preferences': 'Preferences',
        'settings.first_day': 'First day of the week',
        'settings.monday': 'Monday',
        'settings.sunday': 'Sunday',
        'settings.language': 'Language',
        'settings.data_management': 'Data Management',
        'settings.export': 'Export Data',
        'settings.import': 'Import Data',
        'settings.danger_zone': 'Danger Zone',
        'settings.delete_all_data': 'Delete All Data',
        'settings.delete_confirm_msg': 'Are you sure you want to delete all data? Type the word below to confirm.',
        'settings.delete_keyword': 'Delete'
    },
    // French
    fr: {
        'nav.subjects': 'Matières',
        'nav.planner': 'Planificateur',
        'nav.learning': 'Apprentissage',
        'nav.analytics': 'Analytiques',
        'nav.settings': 'Paramètres',
        'nav.metacognition_logs': 'Journaux de Métacognition',

        'home.dashboard': 'Tableau de bord',
        'home.tag': 'Étiquette',
        'home.all_tags': 'Toutes les étiquettes',
        'home.subject': 'Matière',
        'home.all_subjects': 'Toutes les matières',
        'home.new_subject': '+ Nouvelle matière',
        'home.consistency': 'Régularité (35 jours)',
        'home.heatmap_desc': 'Votre carte thermique d\'étude récente.',
        'home.less': 'Moins',
        'home.more': 'Plus',

        'settings.appearance': 'Apparence',
        'settings.theme': 'Thème',
        'settings.preferences': 'Préférences',
        'settings.first_day': 'Premier jour de la semaine',
        'settings.monday': 'Lundi',
        'settings.sunday': 'Dimanche',
        'settings.language': 'Langue',
        'settings.data_management': 'Gestion des données',
        'settings.export': 'Exporter les données',
        'settings.import': 'Importer les données',
        'settings.danger_zone': 'Zone de danger',
        'settings.delete_all_data': 'Supprimer toutes les données',
        'settings.delete_confirm_msg': 'Êtes-vous sûr de vouloir tout supprimer ? Tapez le mot ci-dessous pour confirmer.',
        'settings.delete_keyword': 'Supprimer'
    },
    // Spanish
    es: {
        'nav.subjects': 'Materias',
        'nav.planner': 'Planificador',
        'nav.learning': 'Aprendizaje',
        'nav.analytics': 'Analíticas',
        'nav.settings': 'Ajustes',
        'nav.metacognition_logs': 'Registros de Metacognición',

        'home.dashboard': 'Panel',
        'home.tag': 'Etiqueta',
        'home.all_tags': 'Todas las etiquetas',
        'home.subject': 'Materia',
        'home.all_subjects': 'Todas las materias',
        'home.new_subject': '+ Nueva materia',
        'home.consistency': 'Consistencia (35 días)',
        'home.heatmap_desc': 'Tu mapa de calor de estudio reciente.',
        'home.less': 'Menos',
        'home.more': 'Más',

        'settings.appearance': 'Apariencia',
        'settings.theme': 'Tema',
        'settings.preferences': 'Preferencias',
        'settings.first_day': 'Primer día de la semana',
        'settings.monday': 'Lunes',
        'settings.sunday': 'Domingo',
        'settings.language': 'Idioma',
        'settings.data_management': 'Gestión de datos',
        'settings.export': 'Exportar datos',
        'settings.import': 'Importar datos',
        'settings.danger_zone': 'Zona de peligro',
        'settings.delete_all_data': 'Borrar todos los datos',
        'settings.delete_confirm_msg': '¿Está seguro de que desea eliminar todos los datos? Escriba la palabra a continuación para confirmar.',
        'settings.delete_keyword': 'Borrar'
    },
    // Indonesian
    id: {
        'nav.subjects': 'Mata Pelajaran',
        'nav.planner': 'Perencana',
        'nav.learning': 'Pembelajaran',
        'nav.analytics': 'Analitik',
        'nav.settings': 'Pengaturan',
        'nav.metacognition_logs': 'Log Metakognisi',

        'home.dashboard': 'Dasbor',
        'home.tag': 'Tag',
        'home.all_tags': 'Semua Tag',
        'home.subject': 'Mata Pelajaran',
        'home.all_subjects': 'Semua Mata Pelajaran',
        'home.new_subject': '+ Mata Pelajaran Baru',
        'home.consistency': 'Konsistensi 35 Hari',
        'home.heatmap_desc': 'Peta panas studi terbaru Anda.',
        'home.less': 'Sedikit',
        'home.more': 'Banyak',

        'settings.appearance': 'Tampilan',
        'settings.theme': 'Tema',
        'settings.preferences': 'Preferensi',
        'settings.first_day': 'Hari pertama dalam seminggu',
        'settings.monday': 'Senin',
        'settings.sunday': 'Minggu',
        'settings.language': 'Bahasa',
        'settings.data_management': 'Manajemen Data',
        'settings.export': 'Ekspor Data',
        'settings.import': 'Impor Data',
        'settings.danger_zone': 'Zona Bahaya',
        'settings.delete_all_data': 'Hapus Semua Data',
        'settings.delete_confirm_msg': 'Yakin ingin menghapus semua data? Ketik kata di bawah ini untuk konfirmasi.',
        'settings.delete_keyword': 'Hapus'
    },
    // Simplified Chinese
    'zh-CN': {
        'nav.subjects': '科目',
        'nav.planner': '计划表',
        'nav.learning': '学习',
        'nav.analytics': '分析',
        'nav.settings': '设置',
        'nav.metacognition_logs': '元认知日志',

        'home.dashboard': '仪表板',
        'home.tag': '标签',
        'home.all_tags': '所有标签',
        'home.subject': '科目',
        'home.all_subjects': '所有科目',
        'home.new_subject': '+ 新科目',
        'home.consistency': '35天坚持记录',
        'home.heatmap_desc': '您最近的学习热力图',
        'home.less': '少',
        'home.more': '多',

        'settings.appearance': '外观',
        'settings.theme': '主题',
        'settings.preferences': '偏好',
        'settings.first_day': '一周的第一天',
        'settings.monday': '星期一',
        'settings.sunday': '星期日',
        'settings.language': '语言',
        'settings.data_management': '数据管理',
        'settings.export': '导出数据',
        'settings.import': '导入数据',
        'settings.danger_zone': '危险区域',
        'settings.delete_all_data': '删除所有数据',
        'settings.delete_confirm_msg': '确认要删除所有数据吗？输入下列关键词确认。',
        'settings.delete_keyword': '删除'
    },
    // Traditional Chinese
    'zh-TW': {
        'nav.subjects': '科目',
        'nav.planner': '計畫表',
        'nav.learning': '學習',
        'nav.analytics': '分析',
        'nav.settings': '設定',
        'nav.metacognition_logs': '元認知日誌',

        'home.dashboard': '儀表板',
        'home.tag': '標籤',
        'home.all_tags': '所有標籤',
        'home.subject': '科目',
        'home.all_subjects': '所有科目',
        'home.new_subject': '+ 新科目',
        'home.consistency': '35天堅持記錄',
        'home.heatmap_desc': '您最近的學習熱力圖',
        'home.less': '少',
        'home.more': '多',

        'settings.appearance': '外觀',
        'settings.theme': '主題',
        'settings.preferences': '偏好',
        'settings.first_day': '一週的第一天',
        'settings.monday': '星期一',
        'settings.sunday': '星期日',
        'settings.language': '語言',
        'settings.data_management': '資料管理',
        'settings.export': '匯出資料',
        'settings.import': '匯入資料',
        'settings.danger_zone': '危險區域',
        'settings.delete_all_data': '刪除所有資料',
        'settings.delete_confirm_msg': '確認要刪除所有資料嗎？輸入下列關鍵詞確認。',
        'settings.delete_keyword': '刪除'
    }
};

export function useTranslation() {
    const { language } = useSettings();

    const t = (key: string): string => {
        const langDict = pt[language] || pt['en'];
        return langDict[key] || key;
    };

    return { t };
}

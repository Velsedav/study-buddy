import { useParams } from 'react-router-dom';

export default function SubjectDetail() {
    const { id } = useParams();

    return (
        <div>
            <div className="page-header">
                <h1>Subject: {id}</h1>
            </div>
            <p>Subgoals go here.</p>
        </div>
    );
}

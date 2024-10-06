const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors()); // 모든 도메인에 대해 CORS 허용
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // 기본 페이지로 index.html을 설정
});

// 대원 데이터를 저장할 파일 경로
const CONSTELLATION_FILE = path.join(__dirname, 'constellation.json');

// 대원 데이터 불러오기
app.get('/constellation', (req, res) => {
    fs.readFile(CONSTELLATION_FILE, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 파일이 없는 경우 빈 배열로 초기화하여 반환
                return res.json([]);
            } else {
                return res.status(500).send('파일을 읽는 중 오류가 발생했습니다.');
            }
        }
        try {
            const parsedData = JSON.parse(data);
            res.json(parsedData);
        } catch (parseError) {
            res.status(500).send('JSON 파싱 중 오류가 발생했습니다.');
        }
    });
});

// 대원 데이터 추가하기
app.post('/constellation', (req, res) => {
    const newData = req.body;

    // 기존 데이터를 읽어와서 새 데이터 추가
    fs.readFile(CONSTELLATION_FILE, 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            return res.status(500).send('파일을 읽는 중 오류가 발생했습니다.');
        }

        let constellationData = [];
        if (data) {
            try {
                constellationData = JSON.parse(data);
            } catch (parseError) {
                return res.status(500).send('JSON 파싱 중 오류가 발생했습니다.');
            }
        }

        // 새 데이터 추가
        constellationData.push(newData);

        // 파일에 다시 쓰기 (비동기 처리)
        fs.writeFile(CONSTELLATION_FILE, JSON.stringify(constellationData, null, 2), (writeErr) => {
            if (writeErr) {
                return res.status(500).send('파일을 저장하는 중 오류가 발생했습니다.');
            }

            // 데이터가 성공적으로 저장되었음을 응답
            res.send('데이터가 성공적으로 추가되었습니다.');
        });
    });
});

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
